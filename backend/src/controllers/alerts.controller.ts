import { Request, Response } from 'express'
import * as alertService from '@/services/alert.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /alerts – ALERT-FR-007 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit, unreadCount } = await alertService.listAlerts(req.user, {
    farmId:   req.query.farmId as string | undefined,
    zoneId:   req.query.zoneId as string | undefined,
    status:   req.query.status as string | undefined,
    severity: req.query.severity as string | undefined,
    page:     req.query.page ? Number(req.query.page) : undefined,
    limit:    req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit, unreadCount } })
})

/** GET /alerts/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.getAlert(req.params.id, req.user)
  res.json({ success: true, data: alert })
})

/** PUT /alerts/:id/acknowledge – ALERT-FR-009 */
export const acknowledge = asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.acknowledgeAlert(req.params.id, req.user, req.body.note as string | undefined)
  res.json({ success: true, data: alert })
})
