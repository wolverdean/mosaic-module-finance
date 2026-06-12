import { defineModule }     from '@mosaic/sdk'
import type { ModuleContext } from '@mosaic/sdk'
import { metrics }           from '@opentelemetry/api'
import { migrate }           from './src/migrate.js'
import { createRouter }      from './src/routes/index.js'
import { reportHooks }       from './src/hooks/reports.js'

const meter   = metrics.getMeter('finance')
const _runs   = meter.createCounter('finance.jobs.runs_total')

const ctxRef: { current: ModuleContext | null } = { current: null }
const router = createRouter(ctxRef)

export default defineModule({
  name:    'Finance',
  slug:    'finance',
  version: '1.0.0',
  sdk:     '>=1.0.0',

  migrate,
  router,

  nav: {
    label: 'Finance',
    icon:  'wallet',
    order: 40,
    badge(_ctx: ModuleContext, _userId: number) { return 0 },
  },

  frontend: { entry: '/api/finance/ui.js' },

  reports: reportHooks,

  async onInit(ctx: ModuleContext) {
    ctxRef.current = ctx
    ctx.logger.info('Finance module initialised')
  },

  async health(ctx: ModuleContext) {
    ctx.db.raw.prepare('SELECT 1 FROM finance_transactions LIMIT 1').get()
    return { status: 'ok' as const }
  },
  healthInterval: 120,
})
