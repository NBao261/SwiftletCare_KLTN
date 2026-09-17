import { Request, Response } from 'express'
import * as marketService from '@/services/market.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** POST /harvests – MARKET-FR-001..004 (tự gắn env/flock snapshot + trace_code) */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const batch = await marketService.createHarvest(req.user, req.body)
  res.status(201).json({ success: true, data: batch })
})

/** GET /harvests */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const batches = await marketService.listHarvests(req.user, req.query.farmId as string | undefined)
  res.json({ success: true, data: batches })
})

/** GET /harvests/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const batch = await marketService.getHarvest(req.params.id, req.user)
  res.json({ success: true, data: batch })
})

/** PUT /harvests/:id – MARKET-FR-005 (chỉ khi còn DRAFT) */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const batch = await marketService.updateHarvest(req.params.id, req.user, req.body)
  res.json({ success: true, data: batch })
})

/** DELETE /harvests/:id – xoá mềm, chỉ khi còn DRAFT */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await marketService.removeHarvest(req.params.id, req.user)
  res.json({ success: true, data: { message: 'Đã xoá đợt thu hoạch' } })
})
