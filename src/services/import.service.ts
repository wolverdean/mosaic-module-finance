import type { Database } from 'better-sqlite3'

export interface ImportRow {
  date:          string
  amount:        number
  type:          'income' | 'expense'
  notes?:        string
  categoryName?: string
}

export interface ImportResult {
  imported: number
  skipped:  number
  errors:   { row: number; reason: string }[]
}

export function importTransactions(db: Database, userId: number, rows: ImportRow[]): ImportResult {
  const cats = db.prepare(
    `SELECT id, name FROM finance_categories WHERE user_id = ?`
  ).all(userId) as { id: number; name: string }[]

  const catMap = new Map<string, number>()
  for (const c of cats) catMap.set(c.name.toLowerCase(), c.id)

  const insert = db.prepare(`
    INSERT INTO finance_transactions (user_id, amount, type, category_id, date, notes, source)
    VALUES (?, ?, ?, ?, ?, ?, 'manual')
  `)

  let imported = 0
  const errors: ImportResult['errors'] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
      errors.push({ row: i, reason: 'date must be YYYY-MM-DD' })
      continue
    }
    if (typeof r.amount !== 'number' || r.amount <= 0) {
      errors.push({ row: i, reason: 'amount must be a positive number' })
      continue
    }
    const categoryId = r.categoryName
      ? (catMap.get(r.categoryName.toLowerCase()) ?? null)
      : null

    try {
      insert.run(userId, r.amount, r.type, categoryId, r.date, r.notes ?? '')
      imported++
    } catch (err: any) {
      errors.push({ row: i, reason: err.message })
    }
  }

  return { imported, skipped: 0, errors }
}
