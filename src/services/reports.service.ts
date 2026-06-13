import type { Database }                          from 'better-sqlite3'
import type { ReportItem, ReportSummary }          from '@mosaic/sdk'
import { getMonthlySummary }                       from './summary.service.js'

export function getWeeklyTransactions(db: Database, userId: number, start: string, end: string): ReportItem[] {
  const rows = db.prepare(`
    SELECT ft.id, ft.amount, ft.type, ft.date, ft.notes,
           fc.name AS category_name
    FROM finance_transactions ft
    LEFT JOIN finance_categories fc ON fc.id = ft.category_id
    WHERE ft.user_id = ? AND ft.date >= ? AND ft.date <= ?
    ORDER BY ft.date DESC
  `).all(userId, start, end) as { id: number; amount: number; type: string; date: string; notes: string; category_name: string | null }[]

  return rows.map(r => ({
    id:      r.id,
    title:   `${r.type === 'income' ? '+' : '-'}$${r.amount.toFixed(2)}${r.category_name ? ` · ${r.category_name}` : ''}${r.notes ? ` — ${r.notes}` : ''}`,
    dueDate: r.date,
    status:  r.type,
    url:     '/finance',
  }))
}

export function getFinanceSummary(db: Database, userId: number): ReportSummary {
  const month = new Date().toISOString().slice(0, 7)
  const s = getMonthlySummary(db, userId, month)
  return {
    'Income this month':   Math.round(s.income),
    'Expenses this month': Math.round(s.expenses),
    'Net this month':      Math.round(s.net),
  }
}
