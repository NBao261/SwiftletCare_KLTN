import { Request, Response } from 'express'
import * as deviceService from '@/services/device.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** POST /devices/sensor-nodes/register – FARM-FR-003 */
export const registerSensorNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.registerSensorNode(req.user, {
    device_id: req.body.device_id, zone_id: req.body.zone_id, secret_key: req.body.secret_key,
  })
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

/** PUT /devices/sensor-nodes/:id/reassign-zone – FARM-FR-007b, Flow 21 Nhánh A */
export const reassignZone = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.reassignZone(req.params.id, req.user, req.body)
  res.json({ success: true, data: node })
})

/** POST /devices/camera-nodes/register – FARM-FR-004 */
export const registerCameraNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.registerCameraNode(req.user, {
    device_id: req.body.device_id, zone_id: req.body.zone_id, secret_key: req.body.secret_key, rtsp_url: req.body.rtsp_url,
  })
  res.status(201).json({ success: true, data: node })
})

/** GET /devices/camera-nodes?zoneId= */
export const listCameraNodes = asyncHandler(async (req: Request, res: Response) => {
  const nodes = await deviceService.listCameraNodes(req.query.zoneId as string | undefined, req.user)
  res.json({ success: true, data: nodes })
})

/** GET /devices/system-status – OPS-NFR-004, chỉ Admin */
export const getSystemStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await deviceService.getSystemStatus() })
})

/** POST /devices/{sensor|camera}-nodes/:id/decommission – FARM-FR-008 */
export const decommission = (kind: deviceService.DeviceKind) => asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.decommissionDevice(kind, req.params.id, req.user, req.body.reason as string)
  res.json({ success: true, data: node })
})

/** POST /devices/sensor-nodes/:id/replace – FARM-FR-008 */
export const replaceSensorNode = asyncHandler(async (req: Request, res: Response) => {
  const result = await deviceService.replaceSensorNode(req.params.id, req.user, {
    new_device_id: req.body.new_device_id, secret_key: req.body.secret_key, reason: req.body.reason,
  })
  res.status(201).json({ success: true, data: result })
})
