import { Request, Response } from 'express'
import * as systemService from '@/services/system.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /system/audit-logs – SYSTEM-FR-001 */
export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await systemService.listAuditLogs({
    actorId:    req.query.actorId as string | undefined,
    action:     req.query.action as string | undefined,
    targetType: req.query.targetType as string | undefined,
    targetId:   req.query.targetId as string | undefined,
    from:       req.query.from as string | undefined,
    to:         req.query.to as string | undefined,
    page:       req.query.page as string | undefined,
    limit:      req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** GET /system/settings/default-thresholds – SYSTEM-FR-002 */
export const getDefaultThresholds = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await systemService.getDefaultThresholds() })
})

/** PUT /system/settings/default-thresholds – SYSTEM-FR-002 */
export const updateDefaultThresholds = asyncHandler(async (req: Request, res: Response) => {
  const thresholds = await systemService.updateDefaultThresholds(req.user._id, req.body)
  res.json({ success: true, data: thresholds })
})

/** GET /system/settings/sla – TICKET-FR-006, SLA-NFR-001 */
export const getSlaHours = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await systemService.getSlaHours() })
})

/** PUT /system/settings/sla – TICKET-FR-006, SLA-NFR-001 */
export const updateSlaHours = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await systemService.updateSlaHours(req.user._id, req.body) })
})

/** GET /system/health-overview – SYSTEM-FR-003 */
export const getHealthOverview = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await systemService.getHealthOverview() })
})
