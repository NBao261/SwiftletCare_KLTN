import { Request, Response, NextFunction } from 'express'
import * as farmService from '@/services/farm.service'

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

/** POST /farms/:id/members – AUTH-FR-005/010, Flow 12 bước 1 */
export async function inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invitation = await farmService.inviteMember(req.params.id, req.user, req.body.email as string)
    res.status(201).json({ success: true, data: invitation })
  } catch (err) { next(err) }
}

/** DELETE /farms/:id/members/:userId – Flow 12 bước 5 */
export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farm = await farmService.removeMember(req.params.id, req.user, req.params.userId)
    res.json({ success: true, data: farm })
  } catch (err) { next(err) }
}

/** GET /invitations/:token – xem trước lời mời, không cần đăng nhập */
export async function getInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await farmService.getInvitationByToken(req.params.token)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

/** POST /invitations/:token/accept – AUTH-FR-010, Flow 12 bước 3a */
export async function acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await farmService.acceptInvitation(req.params.token, req.user)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

/** POST /invitations/:token/decline – Flow 12 case 3c, công khai không cần đăng nhập */
export async function declineInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await farmService.declineInvitation(req.params.token)
    res.json({ success: true, data: { message: 'Đã từ chối lời mời' } })
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
