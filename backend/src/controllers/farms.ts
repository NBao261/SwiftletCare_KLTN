import { Request, Response, NextFunction } from 'express'
import * as farmService from '@/services/farmService'

/** GET /farms – FARM-FR-001 */
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farms = await farmService.listFarms(req.user)
    res.json({ success: true, data: farms })
  } catch (err) { next(err) }
}

/** POST /farms – FARM-FR-001 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farm = await farmService.createFarm(req.user, req.body)
    res.status(201).json({ success: true, data: farm })
  } catch (err) { next(err) }
}

/** GET /farms/:id */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farm = await farmService.getFarm(req.params.id, req.user)
    res.json({ success: true, data: farm })
  } catch (err) { next(err) }
}

/** PUT /farms/:id */
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farm = await farmService.updateFarm(req.params.id, req.user, req.body)
    res.json({ success: true, data: farm })
  } catch (err) { next(err) }
}

/** DELETE /farms/:id */
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await farmService.removeFarm(req.params.id, req.user)
    res.json({ success: true, data: { message: 'Đã xóa farm' } })
  } catch (err) { next(err) }
}

/** POST /farms/:id/members – AUTH-FR-005 */
export async function inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farm = await farmService.inviteMember(req.params.id, req.user, req.body.email as string)
    res.status(201).json({ success: true, data: farm })
  } catch (err) { next(err) }
}

/** POST /farms/:id/houses – FARM-FR-002 */
export async function createHouse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const house = await farmService.createHouse(req.params.id, req.user, req.body)
    res.status(201).json({ success: true, data: house })
  } catch (err) { next(err) }
}

/** GET /farms/:id/houses */
export async function listHouses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const houses = await farmService.listHouses(req.params.id, req.user)
    res.json({ success: true, data: houses })
  } catch (err) { next(err) }
}

/** POST /farms/houses/:houseId/zones – FARM-FR-002 */
export async function createZone(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const zone = await farmService.createZone(req.params.houseId, req.user, req.body)
    res.status(201).json({ success: true, data: zone })
  } catch (err) { next(err) }
}

/** GET /farms/houses/:houseId/zones */
export async function listZones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const zones = await farmService.listZones(req.params.houseId, req.user)
    res.json({ success: true, data: zones })
  } catch (err) { next(err) }
}

/** PUT /farms/zones/:zoneId/thresholds – ENV-FR-006 */
export async function updateThresholds(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const zone = await farmService.updateZoneThresholds(req.params.zoneId, req.user, req.body)
    res.json({ success: true, data: zone })
  } catch (err) { next(err) }
}

/** POST /farms/:id/sales-staff – AUTH-FR-005b */
export async function inviteSalesStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const assignment = await farmService.inviteSalesStaff(req.params.id, req.user, req.body.email as string)
    res.status(201).json({ success: true, data: assignment })
  } catch (err) { next(err) }
}

/** GET /farms/:id/sales-staff */
export async function listSalesStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const assignments = await farmService.listSalesStaff(req.params.id, req.user)
    res.json({ success: true, data: assignments })
  } catch (err) { next(err) }
}
