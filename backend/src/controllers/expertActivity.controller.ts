import { Request, Response } from 'express'
import * as expertActivityService from '@/services/expertActivity.service'
import type { ExpertDecisionAction } from '@/services/expertActivity.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /expert-activity – EXPERT-FR-009 (lịch sử hoạt động chuyên gia của 1 farm) */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await expertActivityService.listExpertActivity(req.user, {
    farmId:  req.query.farmId as string,
    from:    req.query.from as string | undefined,
    to:      req.query.to as string | undefined,
    type:    req.query.type as ExpertDecisionAction | undefined,
    zoneId:  req.query.zoneId as string | undefined,
    houseId: req.query.houseId as string | undefined,
    page:    req.query.page as string | undefined,
    limit:   req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})
