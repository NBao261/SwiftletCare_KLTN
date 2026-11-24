import { Request, Response } from 'express'
import * as systemService from '@/services/system.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

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

export const getDefaultThresholds = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await systemService.getDefaultThresholdsView() })
})

export const updateDefaultThresholds = asyncHandler(async (req: Request, res: Response) => {
  const thresholds = await systemService.updateDefaultThresholds(req.user._id, req.body)
  res.json({ success: true, data: thresholds })
})

export const getHealthOverview = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await systemService.getHealthOverview() })
})
