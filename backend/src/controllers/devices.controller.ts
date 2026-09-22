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

/** PUT /devices/sensor-nodes/:id/speaker-schedule – ENV-FR-013b */
export const updateSpeakerSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { enabled, windows, volume, track } = req.body
  const node = await deviceService.updateSpeakerSchedule(req.params.id, req.user, { enabled, windows, volume, track })
  res.json({ success: true, data: node })
})

/** POST /devices/sensor-nodes/:id/relay – ENV-FR-016..018 */
export const controlRelay = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.controlRelay(req.params.id, req.user, req.body)
  res.json({ success: true, data: node })
})

/** DELETE /devices/sensor-nodes/:id/relay-override – ENV-FR-018 (tắt override sớm) */
export const clearRelayOverride = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.clearRelayOverride(req.params.id, req.user)
  res.json({ success: true, data: node })
})

/** PUT /devices/sensor-nodes/:id/reassign-zone – FARM-FR-007b, Flow 21 Nhánh A */
export const reassignZone = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.reassignZone(req.params.id, req.user, req.body)
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

/** GET /devices/system-status – OPS-NFR-004, chỉ Admin */
export const getSystemStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await deviceService.getSystemStatus() })
})
