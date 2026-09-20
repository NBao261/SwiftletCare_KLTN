import { Request, Response } from 'express'
import * as adminService from '@/services/admin.service'
import { asyncHandler } from '@/utils/asyncHandler.util'
import type { SalesAssignmentRequestStatus, SalesAssignmentRequestType } from '@/models/salesAssignmentRequest.model'
import type { Role } from '@/types'

/** GET /admin/users – AUTH-FR-011 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await adminService.listUsers({
    role:   req.query.role as Role | undefined,
    status: req.query.status as 'active' | 'inactive' | undefined,
    page:   req.query.page as string | undefined,
    limit:  req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** PUT /admin/users/:id/status – AUTH-FR-011, Flow 19 */
export const setUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { user, openTickets } = await adminService.setUserStatus(
    req.user._id, req.params.id, req.body.is_active as boolean, req.body.reason as string | undefined,
  )
  // Khoá Technician còn ticket đang giao: báo số ticket để Admin gán lại
  res.json({ success: true, data: user, ...(openTickets ? { meta: { openTickets } } : {}) })
})

/** GET /admin/delete-requests – AUTH-FR-012 */
export const listDeletionRequests = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await adminService.listDeletionRequests({
    page:  req.query.page as string | undefined,
    limit: req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** PUT /admin/delete-requests/:id/complete – AUTH-FR-012, Flow 19 bước 7-8 */
export const completeDeletionRequest = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.completeDeletionRequest(req.user._id, req.params.id, {
    force: req.body?.force === true,
  })
  res.json({ success: true, data: user })
})

/** POST /admin/technicians – AUTH-FR-005c, Flow 16 */
export const createTechnician = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.createTechnician(req.user._id, req.body)
  res.status(201).json({ success: true, data: user })
})

/** POST /admin/sales-staff – AUTH-FR-005c, Flow 16 path 1b */
export const createSalesStaff = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.createSalesStaff(req.user._id, req.body)
  res.status(201).json({ success: true, data: user })
})

/** PUT /admin/technicians/:id/regions – AUTH-FR-005c, Flow 21 case 4a-x */
export const updateTechnicianRegions = asyncHandler(async (req: Request, res: Response) => {
  const technician = await adminService.updateTechnicianRegions(
    req.user._id, req.params.id, req.body.assigned_regions as string[],
  )
  res.json({ success: true, data: technician })
})

/** DELETE /admin/farms/:farmId/sales-staff/:salesStaffId – Flow 16 case 1e */
export const unassignSalesStaff = asyncHandler(async (req: Request, res: Response) => {
  await adminService.unassignSalesStaff(req.user._id, req.params.farmId, req.params.salesStaffId)
  res.json({ success: true, data: { message: 'Đã gỡ Sales Staff khỏi farm' } })
})

/** GET /admin/sales-staff-requests – AUTH-FR-005d */
export const listSalesStaffRequests = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await adminService.listSalesStaffRequests({
    status: req.query.status as SalesAssignmentRequestStatus | undefined,
    type:   req.query.type as SalesAssignmentRequestType | undefined,
    page:   req.query.page as string | undefined,
    limit:  req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** PUT /admin/sales-staff-requests/:id/decision – AUTH-FR-005d */
export const decideSalesStaffRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await adminService.decideSalesStaffRequest(
    req.user._id, req.params.id, req.body.decision as 'APPROVED' | 'REJECTED', req.body.reason as string | undefined,
  )
  res.json({ success: true, data: request })
})
