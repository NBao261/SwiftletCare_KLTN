import { Request, Response } from 'express'
import * as deviceService from '@/services/device.service'
import * as relayOverrideLogService from '@/services/relayOverrideLog.service'
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

/** PUT /devices/sensor-nodes/:id/speaker-schedule – ENV-FR-013b */
export const updateSpeakerSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { enabled, windows, volume, track } = req.body
  const node = await deviceService.updateSpeakerSchedule(req.params.id, req.user, { enabled, windows, volume, track })
  res.json({ success: true, data: node })
})

/** POST /devices/sensor-nodes/:id/relay – ENV-FR-016..018 */
export const controlRelay = asyncHandler(async (req: Request, res: Response) => {
  const { node, delivered } = await deviceService.controlRelay(req.params.id, req.user, req.body)
  // commandDelivered=false: đã lưu trạng thái mong muốn nhưng lệnh chưa tới broker
  res.json({ success: true, data: node, meta: { commandDelivered: delivered } })
})

/** DELETE /devices/sensor-nodes/:id/relay-override – ENV-FR-018 (tắt override sớm) */
export const clearRelayOverride = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.clearRelayOverride(req.params.id, req.user)
  res.json({ success: true, data: node })
})

/** GET /devices/sensor-nodes/:id/relay-overrides – ENV-FR-019 (lịch sử can thiệp tay) */
export const listRelayOverrides = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await relayOverrideLogService.listOverrideLogs(req.params.id, req.user, {
    page:  req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** PUT /devices/sensor-nodes/:id/reassign-zone – FARM-FR-007b, Flow 21 Nhánh A */
export const reassignZone = asyncHandler(async (req: Request, res: Response) => {
  const { node, delivered } = await deviceService.reassignZone(req.params.id, req.user, req.body)
  res.json({ success: true, data: node, meta: { commandDelivered: delivered } })
})

/** POST /devices/camera-nodes/register – FARM-FR-004 */
export const registerCameraNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.registerCameraNode(req.user, {
    device_id: req.body.device_id, secret_key: req.body.secret_key, rtsp_url: req.body.rtsp_url,
    house_id: req.body.house_id, zone_id: req.body.zone_id,   // zone_id: cách gửi cũ, quy ra House chứa Zone
  })
  res.status(201).json({ success: true, data: node })
})

/** GET /devices/camera-nodes?houseId= (zoneId cũ vẫn nhận) */
export const listCameraNodes = asyncHandler(async (req: Request, res: Response) => {
  const nodes = await deviceService.listCameraNodes({
    houseId: req.query.houseId as string | undefined,
    zoneId:  req.query.zoneId as string | undefined,   // cách gửi cũ: quy ra House chứa Zone
  }, req.user)
  res.json({ success: true, data: nodes })
})

/** GET /devices/system-status – OPS-NFR-004, chỉ Admin */
/** PUT /devices/camera-nodes/:id/counting-ring – VISION-FR-018 */
export const updateCountingRing = asyncHandler(async (req: Request, res: Response) => {
  const camera = await deviceService.updateCountingRing(req.params.id, req.user, req.body)
  res.json({ success: true, data: camera })
})

export const getSystemStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await deviceService.getSystemStatus() })
})

/** POST /devices/{sensor|camera}-nodes/:id/decommission – FARM-FR-008 */
export const decommission = (kind: deviceService.DeviceKind) => asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.decommissionDevice(kind, req.params.id, req.user, req.body.reason as string, {
    force: req.body.force as boolean | undefined,
  })
  res.json({ success: true, data: node })
})

/** POST /devices/{sensor|camera}-nodes/:id/restore – FARM-FR-008 (sửa thao tác gỡ nhầm) */
export const restore = (kind: deviceService.DeviceKind) => asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.restoreDevice(kind, req.params.id, req.user, req.body.reason as string)
  res.json({ success: true, data: node })
})

/** POST /devices/sensor-nodes/:id/replace – FARM-FR-008 */
export const replaceSensorNode = asyncHandler(async (req: Request, res: Response) => {
  const result = await deviceService.replaceSensorNode(req.params.id, req.user, {
    new_device_id: req.body.new_device_id, secret_key: req.body.secret_key, reason: req.body.reason,
  })
  res.status(201).json({ success: true, data: result })
})

/** POST /devices/sensor-nodes/:id/commands – TICKET-FR-008, Flow 15 */
export const sendCommand = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.sendRemoteCommand(req.params.id, req.user, {
    command: req.body.command, ticket_id: req.body.ticket_id, ota: req.body.ota,
  })
  res.status(202).json({ success: true, data: node })
})
