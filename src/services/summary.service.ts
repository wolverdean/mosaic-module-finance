import type { Database } from 'better-sqlite3'

export interface CategoryTotal {
  id:    number | null
  name:  string
  type:  string
  color: string
  emoji: string
  total: number
}

export interface MonthlySummary {
  income:     number
  expenses:   number
  net:        number
  byCategory: CategoryTotal[]
}

export interface InventoryIncomeItem {
  id:     string
  title:  string
  amount: number
  date:   string
  notes:  string
  source: 'inventory'
  type:   'income'
}

export function getMonthlySummary(db: Database, userId: number, month: string): MonthlySummary {
  const totals = db.prepare(`
    SELECT type, COALESCE(SUM(amount), 0) AS total
    FROM finance_transactions
    WHERE user_id = ? AND substr(date,1,7) = ?
    GROUP BY type
  `).all(userId, month) as { type: string; total: number }[]

  const income   = totals.find(r => r.type === 'income')?.total  ?? 0
  const expenses = totals.find(r => r.type === 'expense')?.total ?? 0

  const byCategory = db.prepare(`
    SELECT
      fc.id, fc.name, fc.type, fc.color, fc.emoji,
      COALESCE(SUM(ft.amount), 0) AS total
    FROM finance_transactions ft
    LEFT JOIN finance_categories fc ON fc.id = ft.category_id
    WHERE ft.user_id = ? AND substr(ft.date,1,7) = ?
    GROUP BY ft.category_id
    ORDER BY total DESC
  `).all(userId, month) as CategoryTotal[]

  return { income, expenses, net: income - expenses, byCategory }
}

export function getInventoryIncome(db: Database, userId: number, month: string): InventoryIncomeItem[] {
  try {
    const rows = db.prepare(`
      SELECT id, title, sold_price, sold_date
      FROM inventory_items
      WHERE user_id = ? AND sale_status = 'sold' AND substr(sold_date,1,7) = ?
      ORDER BY sold_date DESC
    `).all(userId, month) as { id: number; title: string; sold_price: number; sold_date: string }[]

    return rows.map(r => ({
      id:     `inventory:${r.id}`,
      title:  r.title,
      amount: r.sold_price,
      date:   r.sold_date,
      notes:  `Sold: ${r.title}`,
      source: 'inventory' as const,
      type:   'income'    as const,
    }))
  } catch {
    return []
  }
}
