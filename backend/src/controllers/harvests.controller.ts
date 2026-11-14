import { Request, Response } from 'express'
import * as harvestService from '@/services/harvest.service'
import * as harvestCycleService from '@/services/harvestCycle.service'
import type { HarvestCycleStatus } from '@/models/harvestCycle.model'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** POST /harvests – HARVEST-FR-001..004 (tự gắn env/flock snapshot + trace_code) */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const batch = await harvestService.createHarvest(req.user, req.body)
  res.status(201).json({ success: true, data: batch })
})

/** GET /harvests */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const batches = await harvestService.listHarvests(req.user, req.query.farmId as string | undefined)
  res.json({ success: true, data: batches })
})

/** GET /harvests/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const batch = await harvestService.getHarvest(req.params.id, req.user)
  res.json({ success: true, data: batch })
})

/** PUT /harvests/:id – HARVEST-FR-005 */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const batch = await harvestService.updateHarvest(req.params.id, req.user, req.body)
  res.json({ success: true, data: batch })
})

/** POST /harvests/:id/confirm – HARVEST-FR-006 */
export const confirm = asyncHandler(async (req: Request, res: Response) => {
  const batch = await harvestService.confirmHarvest(req.params.id, req.user)
  res.json({ success: true, data: batch })
})

/** DELETE /harvests/:id – xoá mềm */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await harvestService.removeHarvest(req.params.id, req.user)
  res.json({ success: true, data: { message: 'Đã xoá đợt thu hoạch' } })
})

/** GET /harvests/cycles – HARVEST-FR-007, ANALYTICS-FR-004 */
export const listCycles = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await harvestCycleService.listCycles(req.user, {
    zoneId: req.query.zoneId as string | undefined,
    houseId: req.query.houseId as string | undefined,
    farmId: req.query.farmId as string | undefined,
    status: req.query.status as HarvestCycleStatus | undefined,
    page: req.query.page as number | undefined,
    limit: req.query.limit as number | undefined,
  })
  res.json({ success: true, data: records, meta: { page, limit, total } })
})

/** GET /harvests/cycles/:id */
export const getCycle = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await harvestCycleService.getCycle(req.params.id, req.user) })
})

/** PUT /harvests/cycles/:id/conclusion – EXPERT-FR-020 */
export const concludeCycle = asyncHandler(async (req: Request, res: Response) => {
  const data = await harvestCycleService.concludeCycle(req.user, req.params.id, {
    text: req.body.text as string,
    recommendations: req.body.recommendations as string | undefined,
  })
  res.json({ success: true, data })
})
