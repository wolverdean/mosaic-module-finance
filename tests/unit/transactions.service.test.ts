import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/migrate.js'
import { createCategory } from '../../src/services/categories.service.js'
import {
  createTransaction, updateTransaction, deleteTransaction,
  listTransactions,
} from '../../src/services/transactions.service.js'

function makeDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
  db.prepare(`INSERT INTO users VALUES (1,'a@b.com')`).run()
  migrate({ exec: (sql: string) => db.exec(sql), prepare: db.prepare.bind(db), transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() }, raw: db } as any)
  return db
}

let db: ReturnType<typeof makeDb>
let catId: number
beforeEach(() => {
  db = makeDb()
  catId = createCategory(db, 1, { name: 'Food', type: 'expense' }).id
})

describe('createTransaction', () => {
  it('creates an expense transaction', () => {
    const t = createTransaction(db, 1, { amount: 42.5, type: 'expense', date: '2026-06-10', notes: 'Lunch' })
    expect(t.amount).toBe(42.5)
    expect(t.type).toBe('expense')
    expect(t.source).toBe('manual')
  })

  it('creates a transaction with category', () => {
    const t = createTransaction(db, 1, { amount: 10, type: 'expense', date: '2026-06-10', categoryId: catId })
    expect(t.category_id).toBe(catId)
  })

  it('throws on amount <= 0', () => {
    expect(() => createTransaction(db, 1, { amount: 0, type: 'expense', date: '2026-06-10' })).toThrow()
    expect(() => createTransaction(db, 1, { amount: -5, type: 'expense', date: '2026-06-10' })).toThrow()
  })

  it('throws on invalid date format', () => {
    expect(() => createTransaction(db, 1, { amount: 10, type: 'expense', date: 'not-a-date' })).toThrow()
  })
})

describe('listTransactions', () => {
  it('returns transactions for the month', () => {
    createTransaction(db, 1, { amount: 10, type: 'expense', date: '2026-06-10' })
    createTransaction(db, 1, { amount: 20, type: 'expense', date: '2026-07-01' })
    expect(listTransactions(db, 1, { month: '2026-06' })).toHaveLength(1)
  })

  it('filters by type', () => {
    createTransaction(db, 1, { amount: 10, type: 'expense', date: '2026-06-10' })
    createTransaction(db, 1, { amount: 100, type: 'income', date: '2026-06-15' })
    expect(listTransactions(db, 1, { month: '2026-06', type: 'expense' })).toHaveLength(1)
    expect(listTransactions(db, 1, { month: '2026-06', type: 'income' })).toHaveLength(1)
  })

  it('filters by category', () => {
    const cat2 = createCategory(db, 1, { name: 'Travel', type: 'expense' })
    createTransaction(db, 1, { amount: 10, type: 'expense', date: '2026-06-10', categoryId: catId })
    createTransaction(db, 1, { amount: 50, type: 'expense', date: '2026-06-11', categoryId: cat2.id })
    expect(listTransactions(db, 1, { month: '2026-06', categoryId: catId })).toHaveLength(1)
  })

  it('only returns own transactions', () => {
    createTransaction(db, 1, { amount: 10, type: 'expense', date: '2026-06-10' })
    expect(listTransactions(db, 2, { month: '2026-06' })).toHaveLength(0)
  })
})

describe('updateTransaction', () => {
  it('updates amount and notes', () => {
    const t = createTransaction(db, 1, { amount: 10, type: 'expense', date: '2026-06-10' })
    const u = updateTransaction(db, 1, t.id, { amount: 25, notes: 'Updated' })
    expect(u?.amount).toBe(25)
    expect(u?.notes).toBe('Updated')
  })

  it('returns undefined for unknown id', () => {
    expect(updateTransaction(db, 1, 999, { notes: 'x' })).toBeUndefined()
  })
})

describe('deleteTransaction', () => {
  it('removes a manual transaction', () => {
    const t = createTransaction(db, 1, { amount: 10, type: 'expense', date: '2026-06-10' })
    deleteTransaction(db, 1, t.id)
    expect(listTransactions(db, 1, { month: '2026-06' })).toHaveLength(0)
  })

  it('throws when trying to delete an inventory-sourced transaction', () => {
    const t = createTransaction(db, 1, { amount: 99, type: 'income', date: '2026-06-10', source: 'inventory' })
    expect(() => deleteTransaction(db, 1, t.id)).toThrow('inventory')
  })
})
