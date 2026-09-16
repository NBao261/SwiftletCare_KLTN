import { Request, Response, NextFunction } from 'express'
import * as marketService from '@/services/market.service'

/** POST /harvests – MARKET-FR-001..004 (tự gắn env/flock snapshot + trace_code) */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const batch = await marketService.createHarvest(req.user, req.body)
    res.status(201).json({ success: true, data: batch })
  } catch (err) { next(err) }
}

/** GET /harvests */
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const batches = await marketService.listHarvests(req.user, req.query.farmId as string | undefined)
    res.json({ success: true, data: batches })
  } catch (err) { next(err) }
}

/** GET /harvests/:id */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const batch = await marketService.getHarvest(req.params.id, req.user)
    res.json({ success: true, data: batch })
  } catch (err) { next(err) }
}

/** PUT /harvests/:id – MARKET-FR-005 (chỉ khi còn DRAFT) */
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const batch = await marketService.updateHarvest(req.params.id, req.user, req.body)
    res.json({ success: true, data: batch })
  } catch (err) { next(err) }
}

/** DELETE /harvests/:id – xoá mềm, chỉ khi còn DRAFT */
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await marketService.removeHarvest(req.params.id, req.user)
    res.json({ success: true, data: { message: 'Đã xoá đợt thu hoạch' } })
  } catch (err) { next(err) }
}
