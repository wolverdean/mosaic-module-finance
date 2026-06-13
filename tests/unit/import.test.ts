import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { importTransactions } from '../../src/services/import.service.js'

function makeDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE finance_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      color TEXT NOT NULL DEFAULT '#6366f1',
      emoji TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE finance_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      category_id INTEGER,
      date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  return db
}

const USER = 1

describe('importTransactions', () => {
  let db: ReturnType<typeof makeDb>

  beforeEach(() => { db = makeDb() })

  it('inserts all valid rows and returns correct count', () => {
    const result = importTransactions(db, USER, [
      { date: '2024-01-10', amount: 50, type: 'expense', notes: 'Coffee' },
      { date: '2024-01-11', amount: 200, type: 'income',  notes: 'Freelance' },
    ])
    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    const rows = db.prepare('SELECT * FROM finance_transactions WHERE user_id = ?').all(USER)
    expect(rows).toHaveLength(2)
  })

  it('skips row with invalid date and adds to errors', () => {
    const result = importTransactions(db, USER, [
      { date: 'not-a-date', amount: 10, type: 'expense' },
      { date: '2024-01-01', amount: 20, type: 'expense' },
    ])
    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(0)
    expect(result.errors[0].reason).toMatch(/date/)
  })

  it('skips row with amount <= 0 and adds to errors', () => {
    const result = importTransactions(db, USER, [
      { date: '2024-01-01', amount: 0,   type: 'expense' },
      { date: '2024-01-01', amount: -10, type: 'expense' },
      { date: '2024-01-01', amount: 5,   type: 'expense' },
    ])
    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(2)
  })

  it('matches categoryName case-insensitively to existing category', () => {
    db.prepare(`INSERT INTO finance_categories (user_id, name, type) VALUES (?, ?, ?)`).run(USER, 'Groceries', 'expense')
    const cat = db.prepare(`SELECT id FROM finance_categories WHERE user_id = ?`).get(USER) as { id: number }

    const result = importTransactions(db, USER, [
      { date: '2024-01-01', amount: 30, type: 'expense', categoryName: 'GROCERIES' },
    ])
    expect(result.imported).toBe(1)
    const tx = db.prepare('SELECT * FROM finance_transactions WHERE user_id = ?').get(USER) as any
    expect(tx.category_id).toBe(cat.id)
  })

  it('inserts with category_id null when categoryName does not match', () => {
    const result = importTransactions(db, USER, [
      { date: '2024-01-01', amount: 30, type: 'expense', categoryName: 'NonExistent' },
    ])
    expect(result.imported).toBe(1)
    const tx = db.prepare('SELECT * FROM finance_transactions WHERE user_id = ?').get(USER) as any
    expect(tx.category_id).toBeNull()
  })

  it('sets source to manual on all imported rows', () => {
    importTransactions(db, USER, [
      { date: '2024-01-01', amount: 10, type: 'expense' },
    ])
    const tx = db.prepare('SELECT * FROM finance_transactions WHERE user_id = ?').get(USER) as any
    expect(tx.source).toBe('manual')
  })

  it('continues importing remaining rows after a bad row', () => {
    const result = importTransactions(db, USER, [
      { date: 'bad', amount: 10, type: 'expense' },
      { date: '2024-01-02', amount: 20, type: 'income' },
      { date: '2024-01-03', amount: 30, type: 'expense' },
    ])
    expect(result.imported).toBe(2)
    expect(result.errors).toHaveLength(1)
  })
})
