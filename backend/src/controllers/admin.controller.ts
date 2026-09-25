import { Request, Response } from 'express'
import * as adminService from '@/services/admin.service'
import * as provisionedDeviceService from '@/services/provisionedDevice.service'
import { asyncHandler } from '@/utils/asyncHandler.util'
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

/** PUT /admin/technicians/:id/regions – AUTH-FR-005c, Flow 21 case 4a-x */
export const updateTechnicianRegions = asyncHandler(async (req: Request, res: Response) => {
  const technician = await adminService.updateTechnicianRegions(
    req.user._id, req.params.id, req.body.assigned_regions as string[],
  )
  res.json({ success: true, data: technician })
})

/** POST /admin/provisioned-devices – FARM-FR-003 (secret_key chỉ trả về 1 lần để in nhãn) */
export const createProvisionedDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await provisionedDeviceService.createProvisionedDevice(req.user._id, {
    device_id: req.body.device_id, kind: req.body.kind,
  })
  res.status(201).json({ success: true, data: device })
})

/** GET /admin/provisioned-devices – FARM-FR-003 */
export const listProvisionedDevices = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await provisionedDeviceService.listProvisionedDevices({
    kind:    req.query.kind as string | undefined,
    claimed: req.query.claimed as string | undefined,
    page:    req.query.page as string | undefined,
    limit:   req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})
