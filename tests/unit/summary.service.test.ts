import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/migrate.js'
import { createCategory } from '../../src/services/categories.service.js'
import { createTransaction } from '../../src/services/transactions.service.js'
import {
  getMonthlySummary, getInventoryIncome,
} from '../../src/services/summary.service.js'

function makeDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
  db.prepare(`INSERT INTO users VALUES (1,'a@b.com')`).run()
  migrate({ exec: (sql: string) => db.exec(sql), prepare: db.prepare.bind(db), transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() }, raw: db } as any)
  return db
}

let db: ReturnType<typeof makeDb>
beforeEach(() => { db = makeDb() })

describe('getMonthlySummary', () => {
  it('returns zeros when no transactions', () => {
    const s = getMonthlySummary(db, 1, '2026-06')
    expect(s.income).toBe(0)
    expect(s.expenses).toBe(0)
    expect(s.net).toBe(0)
  })

  it('sums income and expenses separately', () => {
    createTransaction(db, 1, { amount: 1000, type: 'income',  date: '2026-06-01' })
    createTransaction(db, 1, { amount: 200,  type: 'expense', date: '2026-06-10' })
    createTransaction(db, 1, { amount: 50,   type: 'expense', date: '2026-06-15' })
    const s = getMonthlySummary(db, 1, '2026-06')
    expect(s.income).toBe(1000)
    expect(s.expenses).toBe(250)
    expect(s.net).toBe(750)
  })

  it('excludes other months', () => {
    createTransaction(db, 1, { amount: 500, type: 'income', date: '2026-05-31' })
    const s = getMonthlySummary(db, 1, '2026-06')
    expect(s.income).toBe(0)
  })

  it('returns category breakdown', () => {
    const cat = createCategory(db, 1, { name: 'Food', type: 'expense' })
    createTransaction(db, 1, { amount: 100, type: 'expense', date: '2026-06-10', categoryId: cat.id })
    createTransaction(db, 1, { amount: 50,  type: 'expense', date: '2026-06-11', categoryId: cat.id })
    const s = getMonthlySummary(db, 1, '2026-06')
    const foodLine = s.byCategory.find(b => b.name === 'Food')
    expect(foodLine?.total).toBe(150)
  })
})

describe('getInventoryIncome', () => {
  it('returns empty array when inventory table does not exist', () => {
    const items = getInventoryIncome(db, 1, '2026-06')
    expect(items).toEqual([])
  })

  it('returns sold items for the month when inventory table exists', () => {
    db.exec(`
      CREATE TABLE inventory_items (
        id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT,
        sold_price REAL, sold_date TEXT, sale_status TEXT
      )
    `)
    db.prepare(`INSERT INTO inventory_items VALUES (1,1,'Watch',250.00,'2026-06-12','sold')`).run()
    db.prepare(`INSERT INTO inventory_items VALUES (2,1,'Book',15.00,'2026-05-01','sold')`).run()
    const items = getInventoryIncome(db, 1, '2026-06')
    expect(items).toHaveLength(1)
    expect(items[0].amount).toBe(250)
    expect(items[0].notes).toContain('Watch')
    expect(items[0].source).toBe('inventory')
  })
})
