import { Request, Response } from 'express'
import * as deviceService from '@/services/device.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** POST /devices/sensor-nodes/register – FARM-FR-003 */
export const registerSensorNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.registerSensorNode(req.user, req.body)
  res.status(201).json({ success: true, data: node })
})

/** GET /devices/sensor-nodes?zoneId= */
export const listSensorNodes = asyncHandler(async (req: Request, res: Response) => {
  const nodes = await deviceService.listSensorNodes(req.query.zoneId as string | undefined, req.user)
  res.json({ success: true, data: nodes })
})

/** GET /devices/sensor-nodes/:id – FARM-FR-006 */
export const getSensorNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.getSensorNode(req.params.id, req.user)
  res.json({ success: true, data: node })
})

/** PUT /devices/sensor-nodes/:id/thresholds – ENV-FR-006 */
export const updateThresholds = asyncHandler(async (req: Request, res: Response) => {
  const zone = await deviceService.updateNodeThresholds(req.params.id, req.user, req.body)
  res.json({ success: true, data: zone })
})

/** POST /devices/sensor-nodes/:id/relay – ENV-FR-016..018 */
export const controlRelay = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.controlRelay(req.params.id, req.user, req.body)
  res.json({ success: true, data: node })
})

/** POST /devices/camera-nodes/register – FARM-FR-004 */
export const registerCameraNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.registerCameraNode(req.user, req.body)
  res.status(201).json({ success: true, data: node })
})

/** GET /devices/camera-nodes?zoneId= */
export const listCameraNodes = asyncHandler(async (req: Request, res: Response) => {
  const nodes = await deviceService.listCameraNodes(req.query.zoneId as string | undefined, req.user)
  res.json({ success: true, data: nodes })
})

/** GET /devices/system-status – OPS-NFR-004, Admin xem nhanh trạng thái mọi node toàn hệ thống */
export const getSystemStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await deviceService.getSystemNodeStatus(req.user)
  res.json({ success: true, data: result })
})
