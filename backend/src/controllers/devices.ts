import { Request, Response, NextFunction } from 'express'
import * as deviceService from '@/services/deviceService'

/** POST /devices/sensor-nodes/register – FARM-FR-003 */
export async function registerSensorNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const node = await deviceService.registerSensorNode(req.user, req.body)
    res.status(201).json({ success: true, data: node })
  } catch (err) { next(err) }
}

/** GET /devices/sensor-nodes?zoneId= */
export async function listSensorNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const nodes = await deviceService.listSensorNodes(req.query.zoneId as string | undefined)
    res.json({ success: true, data: nodes })
  } catch (err) { next(err) }
}

/** GET /devices/sensor-nodes/:id – FARM-FR-006 */
export async function getSensorNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const node = await deviceService.getSensorNode(req.params.id)
    res.json({ success: true, data: node })
  } catch (err) { next(err) }
}

/** PUT /devices/sensor-nodes/:id/thresholds – ENV-FR-006 */
export async function updateThresholds(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const zone = await deviceService.updateNodeThresholds(req.params.id, req.user, req.body)
    res.json({ success: true, data: zone })
  } catch (err) { next(err) }
}

/** POST /devices/sensor-nodes/:id/relay – ENV-FR-016..018 */
export async function controlRelay(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const node = await deviceService.controlRelay(req.params.id, req.user, req.body)
    res.json({ success: true, data: node })
  } catch (err) { next(err) }
}

/** POST /devices/camera-nodes/register – FARM-FR-004 */
export async function registerCameraNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const node = await deviceService.registerCameraNode(req.user, req.body)
    res.status(201).json({ success: true, data: node })
  } catch (err) { next(err) }
}

/** GET /devices/camera-nodes?zoneId= */
export async function listCameraNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const nodes = await deviceService.listCameraNodes(req.query.zoneId as string | undefined)
    res.json({ success: true, data: nodes })
  } catch (err) { next(err) }
}
