import { Request, Response } from 'express'
import * as adminService from '@/services/admin.service'
import * as provisionedDeviceService from '@/services/provisionedDevice.service'
import * as firmwareImageService from '@/services/firmwareImage.service'
import * as firmwareRolloutService from '@/services/firmwareRollout.service'
import { asyncHandler } from '@/utils/asyncHandler.util'
import type { Role } from '@/types'

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await adminService.listUsers({
    role:   req.query.role as Role | undefined,
    status: req.query.status as 'active' | 'inactive' | 'deleted' | undefined,
    q:      req.query.q as string | undefined,
    page:   req.query.page as string | undefined,
    limit:  req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const createFarmOwner = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.createFarmOwner(req.user._id, {
    email: req.body.email as string, full_name: req.body.full_name as string, phone: req.body.phone as string | undefined,
  })
  res.status(201).json({ success: true, data: user })
})

export const setUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.setUserStatus(
    req.user._id, req.params.id, req.body.is_active as boolean, req.body.reason as string | undefined,
  )
  res.json({ success: true, data: user })
})

export const listDeletionRequests = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await adminService.listDeletionRequests({
    page:  req.query.page as string | undefined,
    limit: req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const completeDeletionRequest = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.completeDeletionRequest(req.user._id, req.params.id)
  res.json({ success: true, data: user })
})

export const rejectDeletionRequest = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.rejectDeletionRequest(req.user._id, req.params.id, req.body.reason as string)
  res.json({ success: true, data: user })
})

// secret_key chỉ trả về 1 lần để in nhãn
export const createProvisionedDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await provisionedDeviceService.createProvisionedDevice(req.user._id, {
    device_id: req.body.device_id, kind: req.body.kind, simulated: req.body.simulated, chip_mac: req.body.chip_mac,
  })
  res.status(201).json({ success: true, data: device })
})

export const listProvisionedDevices = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await provisionedDeviceService.listProvisionedDevices({
    kind:    req.query.kind as string | undefined,
    claimed: req.query.claimed as string | undefined,
    revoked: req.query.revoked as string | undefined,
    deviceId: req.query.deviceId as string | undefined,
    chipMac: req.query.chipMac as string | undefined,
    page:    req.query.page as string | undefined,
    limit:   req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const revokeProvisionedDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await provisionedDeviceService.revokeProvisionedDevice(req.user._id, req.params.id, req.body.reason as string)
  res.json({ success: true, data: device })
})

export const rotateBrokerSecret = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await provisionedDeviceService.rotateBrokerSecret(req.user._id, req.params.id) })
})

export const rotateProvisionedKey = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await provisionedDeviceService.rotateProvisionedKey(req.user._id, req.params.id) })
})

// Kho firmware cho trạm nạp (màn Kho thiết bị)
export const uploadFirmwareImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await firmwareImageService.uploadFirmwareImage(req.user._id, {
    version: req.body.version as string, note: req.body.note as string | undefined,
  }, req.file)
  res.status(201).json({ success: true, data: image })
})

export const listFirmwareImages = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await firmwareImageService.listFirmwareImages() })
})

// File nhị phân, không bọc envelope; SHA-256 ở header để trang kiểm trước khi ghi vào chip
export const downloadFirmwareImage = asyncHandler(async (req: Request, res: Response) => {
  const { buffer, version, sha256 } = await firmwareImageService.getFirmwareImageFile(req.params.id)
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="swiftletcare-${version}-factory.bin"`)
  res.setHeader('X-Firmware-Sha256', sha256)
  res.setHeader('Access-Control-Expose-Headers', 'X-Firmware-Sha256')
  res.send(buffer)
})

export const deleteFirmwareImage = asyncHandler(async (req: Request, res: Response) => {
  await firmwareImageService.deleteFirmwareImage(req.user._id, req.params.id)
  res.json({ success: true, data: null })
})

// Đợt cập nhật firmware từ xa
export const listFirmwareRollouts = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await firmwareRolloutService.listRollouts() })
})

export const createFirmwareRollout = asyncHandler(async (req: Request, res: Response) => {
  const rollout = await firmwareRolloutService.createRollout(req.user._id, {
    image_id: req.body.image_id as string,
    node_ids: req.body.node_ids as string[],
    canary_node_ids: req.body.canary_node_ids as string[] | undefined,
    note: req.body.note as string | undefined,
  })
  res.status(201).json({ success: true, data: rollout })
})

export const changeFirmwareRollout = (action: 'pause' | 'resume' | 'promote' | 'cancel') =>
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await firmwareRolloutService.changeRollout(req.user._id, req.params.id, action) })
  })

export const retryFirmwareRolloutTarget = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await firmwareRolloutService.retryTarget(req.user._id, req.params.id, req.params.nodeId) })
})
