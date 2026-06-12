import { Router }                             from 'express'
import { trace, metrics, SpanStatusCode }     from '@opentelemetry/api'
import type { ModuleContext }                  from '@mosaic/sdk'
import fs                                     from 'node:fs'
import path                                   from 'node:path'
import {
  listCategories, createCategory, updateCategory, deleteCategory,
} from '../services/categories.service.js'
import {
  listTransactions, createTransaction, updateTransaction, deleteTransaction, getTransaction,
} from '../services/transactions.service.js'
import {
  getMonthlySummary, getInventoryIncome,
} from '../services/summary.service.js'
import { getWeeklyTransactions, getFinanceSummary } from '../services/reports.service.js'

// ─── OTel ─────────────────────────────────────────────────────────────────────

const tracer      = trace.getTracer('finance')
const meter       = metrics.getMeter('finance')
const reqCounter  = meter.createCounter('finance.requests_total',    { description: 'Finance route requests' })
const reqDuration = meter.createHistogram('finance.request_duration_ms', { unit: 'ms' })
const txCounter   = meter.createCounter('finance.transactions_total', { description: 'Transactions created' })

function track(op: string, fn: () => void): void {
  const t0 = Date.now()
  tracer.startActiveSpan(`finance.${op}`, span => {
    try {
      fn()
      reqCounter.add(1, { op, status: 'ok' })
      span.setStatus({ code: SpanStatusCode.OK })
    } catch (err) {
      reqCounter.add(1, { op, status: 'error' })
      span.setStatus({ code: SpanStatusCode.ERROR })
      span.recordException(err as Error)
      throw err
    } finally {
      reqDuration.record(Date.now() - t0, { op })
      span.end()
    }
  })
}

// ─── Router factory ───────────────────────────────────────────────────────────

export function createRouter(ctxRef: { current: ModuleContext | null }): Router {
  const router = Router()
  const db = () => ctxRef.current!.db.raw

  // ── Categories ─────────────────────────────────────────────────────────────

  router.get('/categories', (req, res) => {
    track('categories.list', () => {
      const type = req.query.type as 'income' | 'expense' | undefined
      res.json(listCategories(db(), req.userId, type))
    })
  })

  router.post('/categories', (req, res) => {
    track('categories.create', () => {
      const { name, type, color, emoji } = req.body
      if (!name || !String(name).trim()) { res.status(400).json({ error: 'name is required' }); return }
      if (!type || !['income', 'expense'].includes(type)) { res.status(400).json({ error: 'type must be income or expense' }); return }
      res.status(201).json(createCategory(db(), req.userId, { name, type, color, emoji }))
    })
  })

  router.put('/categories/:id', (req, res) => {
    track('categories.update', () => {
      const { name, color, emoji } = req.body
      const updated = updateCategory(db(), req.userId, Number(req.params.id), { name, color, emoji })
      if (!updated) { res.status(404).json({ error: 'Not found' }); return }
      res.json(updated)
    })
  })

  router.delete('/categories/:id', (req, res) => {
    track('categories.delete', () => {
      deleteCategory(db(), req.userId, Number(req.params.id))
      res.json({ ok: true })
    })
  })

  // ── Transactions ───────────────────────────────────────────────────────────

  router.get('/transactions', (req, res) => {
    track('transactions.list', () => {
      const month      = req.query.month      as string | undefined
      const type       = req.query.type       as 'income' | 'expense' | undefined
      const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined
      res.json(listTransactions(db(), req.userId, { month, type, categoryId }))
    })
  })

  router.post('/transactions', (req, res) => {
    track('transactions.create', () => {
      const { amount, type, date, categoryId, notes, source, sourceId } = req.body
      if (amount === undefined || amount === null) { res.status(400).json({ error: 'amount is required' }); return }
      if (typeof amount !== 'number' || amount <= 0) { res.status(400).json({ error: 'amount must be a positive number' }); return }
      if (!type || !['income', 'expense'].includes(type)) { res.status(400).json({ error: 'type must be income or expense' }); return }
      if (!date) { res.status(400).json({ error: 'date is required' }); return }
      try {
        const tx = createTransaction(db(), req.userId, { amount, type, date, categoryId, notes, source, sourceId })
        txCounter.add(1, { type })
        res.status(201).json(tx)
      } catch (err: any) {
        res.status(400).json({ error: err.message })
      }
    })
  })

  router.get('/transactions/:id', (req, res) => {
    track('transactions.get', () => {
      const tx = getTransaction(db(), req.userId, Number(req.params.id))
      if (!tx) { res.status(404).json({ error: 'Not found' }); return }
      res.json(tx)
    })
  })

  router.put('/transactions/:id', (req, res) => {
    track('transactions.update', () => {
      const { amount, type, category_id, date, notes } = req.body
      try {
        const updated = updateTransaction(db(), req.userId, Number(req.params.id), { amount, type, category_id, date, notes })
        if (!updated) { res.status(404).json({ error: 'Not found' }); return }
        res.json(updated)
      } catch (err: any) {
        res.status(400).json({ error: err.message })
      }
    })
  })

  router.delete('/transactions/:id', (req, res) => {
    track('transactions.delete', () => {
      try {
        deleteTransaction(db(), req.userId, Number(req.params.id))
        res.json({ ok: true })
      } catch (err: any) {
        res.status(400).json({ error: err.message })
      }
    })
  })

  // ── Summary & inventory income ─────────────────────────────────────────────

  router.get('/summary', (req, res) => {
    track('summary', () => {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)
      res.json(getMonthlySummary(db(), req.userId, month))
    })
  })

  router.get('/inventory-income', (req, res) => {
    track('inventory-income', () => {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)
      res.json(getInventoryIncome(db(), req.userId, month))
    })
  })

  // ── Reports ────────────────────────────────────────────────────────────────

  router.get('/reports/weekly', (req, res) => {
    track('reports.weekly', () => {
      const { start, end } = req.query as { start: string; end: string }
      if (!start || !end) { res.status(400).json({ error: 'start and end required' }); return }
      res.json(getWeeklyTransactions(db(), req.userId, start, end))
    })
  })

  router.get('/reports/summary', (req, res) => {
    track('reports.summary', () => {
      res.json(getFinanceSummary(db(), req.userId))
    })
  })

  // ── Frontend ───────────────────────────────────────────────────────────────

  router.get('/ui.js', (_req, res) => {
    const uiPath = path.resolve(__dirname, '../../public/ui.js')
    res.setHeader('Content-Type', 'application/javascript')
    res.setHeader('Cache-Control', 'no-cache')
    if (fs.existsSync(uiPath)) {
      res.sendFile(uiPath)
    } else {
      res.send('// finance ui not yet built')
    }
  })

  return router
}
