import { Request, Response } from 'express'
import * as recommendationService from '@/services/recommendation.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

const pageQuery = (req: Request) => ({ page: req.query.page as string | undefined, limit: req.query.limit as string | undefined })

export const listRules = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await recommendationService.listRules(String(req.query.farmId), req.user, pageQuery(req))
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const createRule = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await recommendationService.createRule(req.user, req.body) })
})

export const updateRule = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await recommendationService.updateRule(req.params.id, req.user, req.body) })
})

export const ruleEffects = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await recommendationService.ruleEffects(String(req.query.farmId), req.user) })
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await recommendationService.listRecommendations(req.user, {
    farmId: req.query.farmId as string | undefined,
    houseId: req.query.houseId as string | undefined,
    status: req.query.status as string | undefined,
    ...pageQuery(req),
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await recommendationService.getRecommendation(req.params.id, req.user) })
})

export const accept = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await recommendationService.acceptRecommendation(req.params.id, req.user) })
})

export const reject = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await recommendationService.rejectRecommendation(req.params.id, req.user, req.body.reason) })
})
