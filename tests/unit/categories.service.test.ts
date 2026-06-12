import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/migrate.js'
import {
  listCategories, createCategory, updateCategory, deleteCategory,
} from '../../src/services/categories.service.js'

function makeDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`).run()
  db.prepare(`INSERT INTO users VALUES (1,'a@b.com'),(2,'b@b.com')`).run()
  migrate({ exec: (sql: string) => db.exec(sql), prepare: db.prepare.bind(db), transaction: (fn: () => unknown) => { const t = db.transaction(fn); return t() }, raw: db } as any)
  return db
}

let db: ReturnType<typeof makeDb>
beforeEach(() => { db = makeDb() })

describe('createCategory', () => {
  it('creates an expense category with defaults', () => {
    const c = createCategory(db, 1, { name: 'Food', type: 'expense' })
    expect(c.name).toBe('Food')
    expect(c.type).toBe('expense')
    expect(c.color).toBe('#6366f1')
  })

  it('creates an income category', () => {
    const c = createCategory(db, 1, { name: 'Salary', type: 'income' })
    expect(c.type).toBe('income')
  })

  it('stores color and emoji', () => {
    const c = createCategory(db, 1, { name: 'Food', type: 'expense', color: '#ef4444', emoji: '🍕' })
    expect(c.color).toBe('#ef4444')
    expect(c.emoji).toBe('🍕')
  })

  it('throws on duplicate name for same user', () => {
    createCategory(db, 1, { name: 'Food', type: 'expense' })
    expect(() => createCategory(db, 1, { name: 'Food', type: 'expense' })).toThrow()
  })
})

describe('listCategories', () => {
  it('returns only categories for the user', () => {
    createCategory(db, 1, { name: 'Food', type: 'expense' })
    createCategory(db, 2, { name: 'Other', type: 'expense' })
    expect(listCategories(db, 1)).toHaveLength(1)
  })

  it('filters by type', () => {
    createCategory(db, 1, { name: 'Food', type: 'expense' })
    createCategory(db, 1, { name: 'Salary', type: 'income' })
    expect(listCategories(db, 1, 'expense')).toHaveLength(1)
    expect(listCategories(db, 1, 'income')).toHaveLength(1)
  })
})

describe('updateCategory', () => {
  it('updates name and emoji', () => {
    const c = createCategory(db, 1, { name: 'Food', type: 'expense' })
    const u = updateCategory(db, 1, c.id, { name: 'Groceries', emoji: '🛒' })
    expect(u?.name).toBe('Groceries')
    expect(u?.emoji).toBe('🛒')
  })

  it('returns undefined for unknown id', () => {
    expect(updateCategory(db, 1, 999, { name: 'X' })).toBeUndefined()
  })
})

describe('deleteCategory', () => {
  it('removes a category that has no transactions', () => {
    const c = createCategory(db, 1, { name: 'Food', type: 'expense' })
    deleteCategory(db, 1, c.id)
    expect(listCategories(db, 1)).toHaveLength(0)
  })
})
