import { Request, Response, NextFunction } from 'express'
import * as alertService from '@/services/alert.service'

/** GET /alerts – ALERT-FR-007 */
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, total, page, limit, unreadCount } = await alertService.listAlerts(req.user, {
      farmId:   req.query.farmId as string | undefined,
      zoneId:   req.query.zoneId as string | undefined,
      status:   req.query.status as string | undefined,
      severity: req.query.severity as string | undefined,
      page:     req.query.page ? Number(req.query.page) : undefined,
      limit:    req.query.limit ? Number(req.query.limit) : undefined,
    })
    res.json({ success: true, data: records, meta: { total, page, limit, unreadCount } })
  } catch (err) { next(err) }
}

/** GET /alerts/:id */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alert = await alertService.getAlert(req.params.id, req.user)
    res.json({ success: true, data: alert })
  } catch (err) { next(err) }
}

/** PUT /alerts/:id/acknowledge – ALERT-FR-009 */
export async function acknowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alert = await alertService.acknowledgeAlert(req.params.id, req.user, req.body.note as string | undefined)
    res.json({ success: true, data: alert })
  } catch (err) { next(err) }
}
