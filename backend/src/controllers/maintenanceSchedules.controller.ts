import { Request, Response } from 'express'
import * as scheduleService from '@/services/maintenanceSchedule.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /maintenance-schedules?farmId= – TICKET-FR-013 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await scheduleService.listSchedules(req.user, {
    farmId: req.query.farmId as string | undefined,
    page:   req.query.page as string | undefined,
    limit:  req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** POST /maintenance-schedules – TICKET-FR-013 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await scheduleService.createSchedule(req.user, req.body) })
})

/** PUT /maintenance-schedules/:id – TICKET-FR-013 */
export const update = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await scheduleService.updateSchedule(req.params.id, req.user, req.body) })
})

/** DELETE /maintenance-schedules/:id – TICKET-FR-013 */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await scheduleService.deleteSchedule(req.params.id, req.user)
  res.json({ success: true })
})
