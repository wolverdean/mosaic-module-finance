import { describe, it, expect, vi, beforeEach } from 'vitest'
import request    from 'supertest'
import express    from 'express'
import Database   from 'better-sqlite3'
import { migrate } from '../../src/migrate.js'
import { createRouter } from '../../src/routes/index.js'
import type { ModuleContext } from '@mosaic/sdk'

vi.mock('@opentelemetry/api', () => {
  const span = { end: vi.fn(), setAttribute: vi.fn(), setStatus: vi.fn(), recordException: vi.fn() }
  const tracer = { startActiveSpan: vi.fn().mockImplementation((_n: string, fn: (s: unknown) => unknown) => fn(span)) }
  return {
    trace:          { getTracer: () => tracer },
    metrics:        { getMeter: () => ({ createCounter: () => ({ add: vi.fn() }), createHistogram: () => ({ record: vi.fn() }) }) },
    SpanStatusCode: { ERROR: 'ERROR', OK: 'OK' },
  }
})

function makeApp() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
  db.prepare(`INSERT INTO users VALUES (1,'a@b.com')`).run()
  const moduleDb = { exec: (sql: string) => db.exec(sql), prepare: db.prepare.bind(db), transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() }, raw: db } as any
  migrate(moduleDb)

  const ctxRef: { current: ModuleContext | null } = {
    current: { db: moduleDb, ai: {} as any, logger: { info:()=>{}, error:()=>{}, warn:()=>{}, debug:()=>{} } as any, store:{} as any, events:{} as any, notify:{} as any, config:{} as any, scheduler:{} as any, calendar:{} as any, slug:'finance' }
  }

  const app = express()
  app.use(express.json())
  app.use((req: any, _res: any, next: any) => { req.userId = 1; next() })
  app.use('/api/finance', createRouter(ctxRef))
  return app
}

let app: ReturnType<typeof makeApp>
beforeEach(() => { app = makeApp() })

// AC2 — Categories
describe('AC2 — categories CRUD', () => {
  it('creates a category', async () => {
    const res = await request(app).post('/api/finance/categories')
      .send({ name: 'Food', type: 'expense', color: '#ef4444', emoji: '🍕' }).expect(201)
    expect(res.body.name).toBe('Food')
    expect(res.body.type).toBe('expense')
  })

  it('lists categories', async () => {
    await request(app).post('/api/finance/categories').send({ name: 'Food', type: 'expense' })
    const res = await request(app).get('/api/finance/categories').expect(200)
    expect(res.body).toHaveLength(1)
  })

  it('returns 400 when name missing', async () => {
    await request(app).post('/api/finance/categories').send({ type: 'expense' }).expect(400)
  })

  it('updates a category', async () => {
    const { body: cat } = await request(app).post('/api/finance/categories').send({ name: 'Food', type: 'expense' })
    const res = await request(app).put(`/api/finance/categories/${cat.id}`).send({ name: 'Groceries' }).expect(200)
    expect(res.body.name).toBe('Groceries')
  })

  it('deletes a category', async () => {
    const { body: cat } = await request(app).post('/api/finance/categories').send({ name: 'Food', type: 'expense' })
    await request(app).delete(`/api/finance/categories/${cat.id}`).expect(200)
    const res = await request(app).get('/api/finance/categories')
    expect(res.body).toHaveLength(0)
  })
})

// AC1 — Transactions
describe('AC1 — transactions CRUD', () => {
  it('creates an expense transaction', async () => {
    const res = await request(app).post('/api/finance/transactions')
      .send({ amount: 42.5, type: 'expense', date: '2026-06-10', notes: 'Lunch' }).expect(201)
    expect(res.body.amount).toBe(42.5)
    expect(res.body.type).toBe('expense')
  })

  it('returns 400 for missing amount', async () => {
    await request(app).post('/api/finance/transactions').send({ type: 'expense', date: '2026-06-10' }).expect(400)
  })

  it('returns 400 for amount <= 0', async () => {
    await request(app).post('/api/finance/transactions').send({ amount: 0, type: 'expense', date: '2026-06-10' }).expect(400)
  })

  it('updates a transaction', async () => {
    const { body: t } = await request(app).post('/api/finance/transactions').send({ amount: 10, type: 'expense', date: '2026-06-10' })
    const res = await request(app).put(`/api/finance/transactions/${t.id}`).send({ amount: 20, notes: 'Updated' }).expect(200)
    expect(res.body.amount).toBe(20)
  })

  it('deletes a transaction', async () => {
    const { body: t } = await request(app).post('/api/finance/transactions').send({ amount: 10, type: 'expense', date: '2026-06-10' })
    await request(app).delete(`/api/finance/transactions/${t.id}`).expect(200)
    const res = await request(app).get('/api/finance/transactions?month=2026-06')
    expect(res.body).toHaveLength(0)
  })
})

// AC3 — List with filters
describe('AC3 — list transactions filtered', () => {
  it('filters by month', async () => {
    await request(app).post('/api/finance/transactions').send({ amount: 10, type: 'expense', date: '2026-06-10' })
    await request(app).post('/api/finance/transactions').send({ amount: 20, type: 'expense', date: '2026-07-01' })
    const res = await request(app).get('/api/finance/transactions?month=2026-06').expect(200)
    expect(res.body).toHaveLength(1)
  })

  it('filters by type', async () => {
    await request(app).post('/api/finance/transactions').send({ amount: 10, type: 'expense', date: '2026-06-10' })
    await request(app).post('/api/finance/transactions').send({ amount: 100, type: 'income', date: '2026-06-10' })
    const res = await request(app).get('/api/finance/transactions?month=2026-06&type=income').expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].type).toBe('income')
  })
})

// AC4/AC5 — Monthly summary
describe('AC4+AC5 — monthly summary', () => {
  it('returns income, expenses, net, and byCategory', async () => {
    const { body: cat } = await request(app).post('/api/finance/categories').send({ name: 'Food', type: 'expense' })
    await request(app).post('/api/finance/transactions').send({ amount: 1000, type: 'income',  date: '2026-06-01' })
    await request(app).post('/api/finance/transactions').send({ amount: 200,  type: 'expense', date: '2026-06-10', categoryId: cat.id })
    const res = await request(app).get('/api/finance/summary?month=2026-06').expect(200)
    expect(res.body.income).toBe(1000)
    expect(res.body.expenses).toBe(200)
    expect(res.body.net).toBe(800)
    expect(res.body.byCategory.find((b: any) => b.name === 'Food').total).toBe(200)
  })
})

// AC6 — Inventory income
describe('AC6 — inventory income endpoint', () => {
  it('returns empty array when inventory not installed', async () => {
    const res = await request(app).get('/api/finance/inventory-income?month=2026-06').expect(200)
    expect(res.body).toEqual([])
  })
})

// AC7/AC8 — Report routes
describe('AC7/AC8 — report routes', () => {
  it('GET /reports/weekly returns transactions in window', async () => {
    await request(app).post('/api/finance/transactions').send({ amount: 50, type: 'expense', date: '2026-06-10' })
    const res = await request(app).get('/api/finance/reports/weekly?start=2026-06-08&end=2026-06-14').expect(200)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /reports/summary returns income/expenses/net', async () => {
    const res = await request(app).get('/api/finance/reports/summary').expect(200)
    expect('income this month' in res.body || 'Income this month' in res.body || Object.keys(res.body).some(k => k.toLowerCase().includes('income'))).toBe(true)
  })
})

// AC9 — Frontend
describe('AC9 — frontend', () => {
  it('GET /ui.js returns javascript', async () => {
    const res = await request(app).get('/api/finance/ui.js').expect(200)
    expect(res.headers['content-type']).toMatch(/javascript/)
  })
})
