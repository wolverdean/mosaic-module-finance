import type { Database } from 'better-sqlite3'

export interface Transaction {
  id:          number
  user_id:     number
  amount:      number
  type:        'income' | 'expense'
  category_id: number | null
  date:        string
  notes:       string
  source:      'manual' | 'inventory'
  source_id:   string | null
  created_at:  string
  updated_at:  string
}

export interface CreateTransactionInput {
  amount:      number
  type:        'income' | 'expense'
  date:        string
  categoryId?: number
  notes?:      string
  source?:     'manual' | 'inventory'
  sourceId?:   string
}

export interface ListTransactionFilters {
  month?:      string   // YYYY-MM
  type?:       'income' | 'expense'
  categoryId?: number
}

export function createTransaction(db: Database, userId: number, input: CreateTransactionInput): Transaction {
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    throw new Error('amount must be a positive number')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error('date must be YYYY-MM-DD')
  }

  const result = db.prepare(`
    INSERT INTO finance_transactions
      (user_id, amount, type, category_id, date, notes, source, source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    input.amount,
    input.type,
    input.categoryId ?? null,
    input.date,
    input.notes    ?? '',
    input.source   ?? 'manual',
    input.sourceId ?? null,
  )
  return db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(result.lastInsertRowid) as Transaction
}

export function listTransactions(db: Database, userId: number, filters: ListTransactionFilters = {}): Transaction[] {
  const conditions = ['user_id = ?']
  const params: unknown[] = [userId]

  if (filters.month) {
    conditions.push("substr(date,1,7) = ?")
    params.push(filters.month)
  }
  if (filters.type) {
    conditions.push('type = ?')
    params.push(filters.type)
  }
  if (filters.categoryId !== undefined) {
    conditions.push('category_id = ?')
    params.push(filters.categoryId)
  }

  return db.prepare(
    `SELECT * FROM finance_transactions WHERE ${conditions.join(' AND ')} ORDER BY date DESC, id DESC`
  ).all(...params) as Transaction[]
}

export function getTransaction(db: Database, userId: number, id: number): Transaction | undefined {
  return db.prepare('SELECT * FROM finance_transactions WHERE id = ? AND user_id = ?').get(id, userId) as Transaction | undefined
}

export function updateTransaction(
  db: Database, userId: number, id: number,
  input: Partial<Pick<Transaction, 'amount' | 'type' | 'category_id' | 'date' | 'notes'>>,
): Transaction | undefined {
  if (!getTransaction(db, userId, id)) return undefined
  if (input.amount !== undefined && input.amount <= 0) throw new Error('amount must be positive')

  db.prepare(`
    UPDATE finance_transactions SET
      amount      = COALESCE(?, amount),
      type        = COALESCE(?, type),
      category_id = COALESCE(?, category_id),
      date        = COALESCE(?, date),
      notes       = COALESCE(?, notes),
      updated_at  = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    input.amount      !== undefined ? input.amount      : null,
    input.type        !== undefined ? input.type        : null,
    input.category_id !== undefined ? input.category_id : null,
    input.date        !== undefined ? input.date        : null,
    input.notes       !== undefined ? input.notes       : null,
    id, userId,
  )
  return getTransaction(db, userId, id)
}

export function deleteTransaction(db: Database, userId: number, id: number): void {
  const tx = getTransaction(db, userId, id)
  if (!tx) return
  if (tx.source === 'inventory') throw new Error('Cannot delete inventory-sourced transaction')
  db.prepare('DELETE FROM finance_transactions WHERE id = ? AND user_id = ?').run(id, userId)
}
