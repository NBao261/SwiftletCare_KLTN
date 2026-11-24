import { Request, Response } from 'express'
import * as maintenanceService from '@/services/maintenance.service'
import type { MaintenancePlanState } from '@/models/maintenancePlan.model'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await maintenanceService.listPlans(req.user, {
    farmId:  req.query.farmId as string | undefined,
    houseId: req.query.houseId as string | undefined,
    state:   req.query.state as MaintenancePlanState | undefined,
    page:    req.query.page ? Number(req.query.page) : undefined,
    limit:   req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await maintenanceService.createPlan(req.user, req.body as maintenanceService.MaintenancePlanInput)
  res.status(201).json({ success: true, data: plan })
})

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const { interval, checklist_template: checklistTemplate, source, note } = req.body as Record<string, unknown>
  const plan = await maintenanceService.updatePlan(req.params.id, req.user, {
    interval: interval as number | undefined,
    checklist_template: checklistTemplate as string[] | undefined,
    source: source as string | undefined,
    note: note as string | undefined,
  })
  res.json({ success: true, data: plan })
})

export const retirePlan = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await maintenanceService.retirePlan(req.params.id, req.user) })
})

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  const plan = await maintenanceService.addComment(req.params.id, req.user, req.body.text as string)
  res.status(201).json({ success: true, data: plan })
})

export const listDue = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await maintenanceService.listDuePlans(req.user, {
    farmId:  req.query.farmId as string | undefined,
    houseId: req.query.houseId as string | undefined,
    page:    req.query.page as number | undefined,
    limit:   req.query.limit as number | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})
