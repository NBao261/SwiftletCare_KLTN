import { Request, Response } from 'express'
import * as workOrderService from '@/services/workOrder.service'
import * as opsMetricsService from '@/services/opsMetrics.service'
import type { SiteCause, WorkOrderStatus } from '@/models/workOrder.model'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /work-orders – OPS-FR-001…004 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await workOrderService.listWorkOrders(req.user, {
    farmId:     req.query.farmId as string | undefined,
    houseId:    req.query.houseId as string | undefined,
    alertId:    req.query.alertId as string | undefined,
    assigneeId: req.query.assigneeId as string | undefined,
    status:     req.query.status as WorkOrderStatus | undefined,
    open:       req.query.open === undefined ? undefined : req.query.open === 'true',
    page:       req.query.page ? Number(req.query.page) : undefined,
    limit:      req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** POST /work-orders – OPS-FR-001 (Farm Owner mở tay) */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const wo = await workOrderService.createManualWorkOrder(req.user, {
    house_id: req.body.house_id as string,
    title: req.body.title as string,
    description: req.body.description as string | undefined,
    alert_id: req.body.alert_id as string | undefined,
  })
  res.status(201).json({ success: true, data: wo })
})

/** GET /work-orders/metrics – OPS-FR-009 */
export const metrics = asyncHandler(async (req: Request, res: Response) => {
  const data = await opsMetricsService.getOpsMetrics(req.user, {
    farmId: req.query.farmId as string,
    houseId: req.query.houseId as string | undefined,
    from: new Date(req.query.from as string),
    to: new Date(req.query.to as string),
  })
  res.json({ success: true, data })
})

/** GET /work-orders/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await workOrderService.getWorkOrder(req.params.id, req.user) })
})

/** POST /work-orders/:id/start – OPS-FR-002 */
export const start = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await workOrderService.startWorkOrder(req.params.id, req.user) })
})

/** POST /work-orders/:id/done – OPS-FR-002, ALERT-FR-018 */
export const done = asyncHandler(async (req: Request, res: Response) => {
  const wo = await workOrderService.completeWorkOrder(req.params.id, req.user, {
    cause: req.body.cause as SiteCause | undefined,
    work_note: req.body.work_note as string | undefined,
  }, (req.files as Express.Multer.File[] | undefined) ?? [])
  res.json({ success: true, data: wo })
})

/** POST /work-orders/:id/approve – OPS-FR-004 */
export const approve = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await workOrderService.approveWorkOrder(req.params.id, req.user) })
})

/** POST /work-orders/:id/reopen – OPS-FR-004 */
export const reopen = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await workOrderService.reopenWorkOrder(req.params.id, req.user, (req.body.note as string).trim()) })
})

/** POST /work-orders/:id/cancel – OPS-FR-004 */
export const cancel = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await workOrderService.cancelWorkOrder(req.params.id, req.user, (req.body.reason as string).trim()) })
})

/** POST /work-orders/:id/reassign – OPS-FR-004 */
export const reassign = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await workOrderService.reassignWorkOrder(req.params.id, req.user, req.body.assignee_id as string) })
})
