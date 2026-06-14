import type { Database }                          from 'better-sqlite3'
import type { ReportItem, ReportSummary, DetailedReport } from '@mosaic/sdk'
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

export function getDetailedFinanceReport(db: Database, userId: number, start: string, end: string): DetailedReport {
  const totals = db.prepare(`
    SELECT type, COALESCE(SUM(amount), 0) AS total
    FROM finance_transactions
    WHERE user_id = ? AND date >= ? AND date <= ?
    GROUP BY type
  `).all(userId, start, end) as { type: string; total: number }[]

  const income   = totals.find(r => r.type === 'income')?.total  ?? 0
  const expenses = totals.find(r => r.type === 'expense')?.total ?? 0

  const byCat = db.prepare(`
    SELECT COALESCE(fc.name, 'Uncategorized') AS category, ft.type,
           COALESCE(SUM(ft.amount), 0) AS total
    FROM finance_transactions ft
    LEFT JOIN finance_categories fc ON fc.id = ft.category_id
    WHERE ft.user_id = ? AND ft.date >= ? AND ft.date <= ?
    GROUP BY ft.category_id, ft.type
    ORDER BY total DESC
  `).all(userId, start, end) as { category: string; type: string; total: number }[]

  const txns = db.prepare(`
    SELECT ft.id, ft.amount, ft.type, ft.date, ft.notes,
           COALESCE(fc.name, 'Uncategorized') AS category_name
    FROM finance_transactions ft
    LEFT JOIN finance_categories fc ON fc.id = ft.category_id
    WHERE ft.user_id = ? AND ft.date >= ? AND ft.date <= ?
    ORDER BY ft.date DESC
    LIMIT 50
  `).all(userId, start, end) as { id: number; amount: number; type: string; date: string; notes: string; category_name: string }[]

  return {
    label: 'Finance',
    sections: [
      {
        type: 'kv',
        title: 'Summary',
        rows: { Income: Math.round(income), Expenses: Math.round(expenses), Net: Math.round(income - expenses) },
      },
      {
        type:  'table',
        title: 'By Category',
        cols:  ['Category', 'Type', 'Total ($)'],
        rows:  byCat.map(r => [r.category, r.type, Math.round(r.total)]),
      },
      {
        type:  'list',
        title: 'Transactions',
        items: txns.map(r => ({
          id:      r.id,
          title:   `${r.type === 'income' ? '+' : '-'}$${r.amount.toFixed(2)} · ${r.category_name}${r.notes ? ` — ${r.notes}` : ''}`,
          dueDate: r.date,
          status:  r.type,
          url:     '/finance',
        })),
      },
    ],
  }
}
