import { Request, Response } from 'express'
import * as deviceService from '@/services/device.service'
import * as relayOverrideLogService from '@/services/relayOverrideLog.service'
import { asyncHandler } from '@/utils/asyncHandler.util'
import * as cameraSourceService from '@/services/cameraSource.service'

export const registerSensorNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.registerSensorNode(req.user, {
    device_id: req.body.device_id, zone_id: req.body.zone_id, secret_key: req.body.secret_key,
  })
  res.status(201).json({ success: true, data: node })
})

export const listSensorNodes = asyncHandler(async (req: Request, res: Response) => {
  const nodes = await deviceService.listSensorNodes(
    req.query.zoneId as string | undefined, req.user, req.query.removed as 'recent' | undefined,
  )
  res.json({ success: true, data: nodes })
})

export const getSensorNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.getSensorNode(req.params.id, req.user)
  res.json({ success: true, data: node })
})

export const updateSpeakerSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { enabled, windows, volume, track } = req.body
  const node = await deviceService.updateSpeakerSchedule(req.params.id, req.user, { enabled, windows, volume, track })
  res.json({ success: true, data: node })
})

export const controlRelay = asyncHandler(async (req: Request, res: Response) => {
  const { node, delivered } = await deviceService.controlRelay(req.params.id, req.user, req.body)
  // commandDelivered=false: đã lưu trạng thái nhưng lệnh chưa tới broker
  res.json({ success: true, data: node, meta: { commandDelivered: delivered } })
})

export const clearRelayOverride = asyncHandler(async (req: Request, res: Response) => {
  const relayName = req.query.relayName as (typeof deviceService.RELAY_NAMES)[number] | undefined
  const node = await deviceService.clearRelayOverride(req.params.id, req.user, relayName)
  res.json({ success: true, data: node })
})

export const listRelayOverrides = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await relayOverrideLogService.listOverrideLogs(req.params.id, req.user, {
    page:  req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const reassignZone = asyncHandler(async (req: Request, res: Response) => {
  const { node, delivered } = await deviceService.reassignZone(req.params.id, req.user, req.body)
  res.json({ success: true, data: node, meta: { commandDelivered: delivered } })
})

export const registerCameraNode = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.registerCameraNode(req.user, {
    device_id: req.body.device_id, secret_key: req.body.secret_key,
    house_id: req.body.house_id, zone_id: req.body.zone_id,   // zone_id cũ: quy ra House chứa Zone
  })
  res.status(201).json({ success: true, data: node })
})

export const listCameraNodes = asyncHandler(async (req: Request, res: Response) => {
  const nodes = await deviceService.listCameraNodes({
    houseId: req.query.houseId as string | undefined,
    zoneId:  req.query.zoneId as string | undefined,   // zoneId cũ: quy ra House chứa Zone
    removed: req.query.removed as 'recent' | undefined,
  }, req.user)
  res.json({ success: true, data: nodes })
})

export const updateCountingRing = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body.rings
    ? { rings: req.body.rings }
    : { firstRing: { points: req.body.points, into_ring_is_exit: req.body.into_ring_is_exit } }
  const camera = await deviceService.updateCountingRing(req.params.id, req.user, input)
  res.json({ success: true, data: camera })
})

export const getSystemStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await deviceService.getSystemStatus() })
})

export const decommission = (kind: deviceService.DeviceKind) => asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.decommissionDevice(kind, req.params.id, req.user, req.body.reason as string, {
    force: req.body.force as boolean | undefined,
  })
  res.json({ success: true, data: node })
})

export const restore = (kind: deviceService.DeviceKind) => asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.restoreDevice(kind, req.params.id, req.user, req.body.reason as string)
  res.json({ success: true, data: node })
})

export const replaceSensorNode = asyncHandler(async (req: Request, res: Response) => {
  const result = await deviceService.replaceSensorNode(req.params.id, req.user, {
    new_device_id: req.body.new_device_id, secret_key: req.body.secret_key, reason: req.body.reason,
  })
  res.status(201).json({ success: true, data: result })
})

export const sendCommand = asyncHandler(async (req: Request, res: Response) => {
  const node = await deviceService.sendRemoteCommand(req.params.id, req.user, {
    command: req.body.command, ota: req.body.ota,
  })
  res.status(202).json({ success: true, data: node })
})

// Địa chỉ camera IP của nút AI (Farm Owner)
export const getCameraSource = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await cameraSourceService.getCameraSource(req.user, req.params.id) })
})

export const updateCameraSource = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: await cameraSourceService.updateCameraSource(req.user, req.params.id, {
      host: req.body.host as string, port: req.body.port as number, username: req.body.username as string,
      path: req.body.path as string, password: req.body.password as string | undefined,
    }),
  })
})
