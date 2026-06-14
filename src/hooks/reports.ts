import type { ReportHooks, ModuleContext } from '@mosaic/sdk'
import { getWeeklyTransactions, getFinanceSummary, getDetailedFinanceReport } from '../services/reports.service.js'

export const reportHooks: ReportHooks = {
  weekly(ctx: ModuleContext, userId: number, start: string, end: string) {
    return getWeeklyTransactions(ctx.db.raw, userId, start, end)
  },
  summary(ctx: ModuleContext, userId: number) {
    return getFinanceSummary(ctx.db.raw, userId)
  },
  detailed(ctx: ModuleContext, userId: number, start: string, end: string) {
    return getDetailedFinanceReport(ctx.db.raw, userId, start, end)
  },
}
