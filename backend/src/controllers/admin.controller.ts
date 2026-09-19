import { Request, Response, NextFunction } from 'express'
import * as adminService from '@/services/admin.service'
import type { SalesAssignmentRequestStatus } from '@/models/salesAssignmentRequest.model'
import type { Role } from '@/types'

/** GET /admin/users – AUTH-FR-011 */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, total, page, limit } = await adminService.listUsers({
      role:   req.query.role as Role | undefined,
      status: req.query.status as 'active' | 'inactive' | undefined,
      page:   req.query.page ? Number(req.query.page) : undefined,
      limit:  req.query.limit ? Number(req.query.limit) : undefined,
    })
    res.json({ success: true, data: records, meta: { total, page, limit } })
  } catch (err) { next(err) }
}

/** PUT /admin/users/:id/status – AUTH-FR-011, Flow 19 */
export async function setUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await adminService.setUserStatus(
      req.user._id, req.params.id, req.body.is_active as boolean, req.body.reason as string | undefined,
    )
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
}

/** GET /admin/delete-requests – AUTH-FR-012 */
export async function listDeletionRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, total, page, limit } = await adminService.listDeletionRequests({
      page:  req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    })
    res.json({ success: true, data: records, meta: { total, page, limit } })
  } catch (err) { next(err) }
}

/** PUT /admin/delete-requests/:id/complete – AUTH-FR-012, Flow 19 bước 7-8 */
export async function completeDeletionRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await adminService.completeDeletionRequest(req.user._id, req.params.id)
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
}

/** POST /admin/technicians – AUTH-FR-005c, Flow 16 */
export async function createTechnician(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await adminService.createTechnician(req.user._id, req.body)
    res.status(201).json({ success: true, data: user })
  } catch (err) { next(err) }
}

/** POST /admin/sales-staff – AUTH-FR-005c, Flow 16 path 1b */
export async function createSalesStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await adminService.createSalesStaff(req.user._id, req.body)
    res.status(201).json({ success: true, data: user })
  } catch (err) { next(err) }
}

/** PUT /admin/technicians/:id/regions – AUTH-FR-005c, Flow 21 case 4a-x */
export async function updateTechnicianRegions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const technician = await adminService.updateTechnicianRegions(
      req.user._id, req.params.id, req.body.assigned_regions as string[],
    )
    res.json({ success: true, data: technician })
  } catch (err) { next(err) }
}

/** DELETE /admin/farms/:farmId/sales-staff/:salesStaffId – Flow 16 case 1e */
export async function unassignSalesStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await adminService.unassignSalesStaff(req.user._id, req.params.farmId, req.params.salesStaffId)
    res.json({ success: true, data: { message: 'Đã gỡ Sales Staff khỏi farm' } })
  } catch (err) { next(err) }
}

/** GET /admin/sales-staff-requests – AUTH-FR-005d */
export async function listSalesStaffRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, total, page, limit } = await adminService.listSalesStaffRequests({
      status: req.query.status as SalesAssignmentRequestStatus | undefined,
      page:   req.query.page as string | undefined,
      limit:  req.query.limit as string | undefined,
    })
    res.json({ success: true, data: records, meta: { total, page, limit } })
  } catch (err) { next(err) }
}

/** PUT /admin/sales-staff-requests/:id/decision – AUTH-FR-005d */
export async function decideSalesStaffRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await adminService.decideSalesStaffRequest(
      req.user._id, req.params.id, req.body.decision as 'APPROVED' | 'REJECTED', req.body.reason as string | undefined,
    )
    res.json({ success: true, data: request })
  } catch (err) { next(err) }
}
