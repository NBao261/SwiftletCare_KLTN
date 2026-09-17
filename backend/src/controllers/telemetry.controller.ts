import { Request, Response } from 'express'
import * as telemetryService from '@/services/telemetry.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /telemetry/zones/:id/latest – ENV-FR-004 */
export const getLatest = asyncHandler(async (req: Request, res: Response) => {
  const latest = await telemetryService.getLatest(req.params.id, req.user)
  res.json({ success: true, data: latest })
})

/** GET /telemetry/zones/:id/history?from=&to=&page=&limit= – ANALYTICS-FR-001 */
export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, page, limit } = req.query as Record<string, string | undefined>
  const result = await telemetryService.getHistory(req.params.id, req.user, {
    from, to,
    page:  page  ? Number(page)  : undefined,
    limit: limit ? Number(limit) : undefined,
  })
  res.json({ success: true, data: result.records, meta: { page: result.page, limit: result.limit, total: result.total } })
})
