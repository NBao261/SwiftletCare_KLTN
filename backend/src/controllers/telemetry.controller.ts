import { Request, Response, NextFunction } from 'express'
import * as telemetryService from '@/services/telemetry.service'

/** GET /telemetry/zones/:id/latest – ENV-FR-004 */
export async function getLatest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const latest = await telemetryService.getLatest(req.params.id)
    res.json({ success: true, data: latest })
  } catch (err) { next(err) }
}

/** GET /telemetry/zones/:id/history?from=&to=&page=&limit= – ANALYTICS-FR-001 */
export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to, page, limit } = req.query as Record<string, string | undefined>
    const result = await telemetryService.getHistory(req.params.id, {
      from, to,
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
    })
    res.json({ success: true, data: result.records, meta: { page: result.page, limit: result.limit, total: result.total } })
  } catch (err) { next(err) }
}
