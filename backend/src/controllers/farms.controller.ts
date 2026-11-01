import { Request, Response } from 'express'
import * as farmService from '@/services/farm.service'
import * as coefficientProposalService from '@/services/coefficientProposal.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /farms – FARM-FR-001 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const farms = await farmService.listFarms(req.user)
  res.json({ success: true, data: farms })
})

/** POST /farms – FARM-FR-001 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.createFarm(req.user, req.body)
  res.status(201).json({ success: true, data: farm })
})

/** GET /farms/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.getFarm(req.params.id, req.user)
  res.json({ success: true, data: farm })
})

/** PUT /farms/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.updateFarm(req.params.id, req.user, req.body)
  res.json({ success: true, data: farm })
})

/** DELETE /farms/:id */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await farmService.removeFarm(req.params.id, req.user)
  res.json({ success: true, data: { message: 'Đã xóa farm' } })
})

/** POST /farms/:id/members – AUTH-FR-005/010, Flow 12 bước 1 (mời đồng sở hữu hoặc Domain Expert) */
export const inviteMember = asyncHandler(async (req: Request, res: Response) => {
  const invitation = await farmService.inviteMember(req.params.id, req.user, {
    email:    req.body.email as string,
    role:     req.body.role,
  })
  res.status(201).json({ success: true, data: invitation })
})

/** DELETE /farms/:id/members/:userId – Flow 12 bước 5 */
export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.removeMember(req.params.id, req.user, req.params.userId)
  res.json({ success: true, data: farm })
})

/** GET /invitations/:token – xem trước lời mời, không cần đăng nhập */
export const getInvitation = asyncHandler(async (req: Request, res: Response) => {
  const result = await farmService.getInvitationByToken(req.params.token)
  res.json({ success: true, data: result })
})

/** POST /invitations/:token/accept – AUTH-FR-010, Flow 12 bước 3a */
export const acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
  const result = await farmService.acceptInvitation(req.params.token, req.user)
  res.json({ success: true, data: result })
})

/** POST /invitations/:token/create-account – AUTH-FR-010, người được mời chưa có tài khoản */
export const createAccountFromInvitation = asyncHandler(async (req: Request, res: Response) => {
  const user = await farmService.createAccountFromInvitation(req.params.token, req.body)
  res.status(201).json({ success: true, data: user })
})

/** POST /invitations/:token/decline – Flow 12 case 3c, công khai không cần đăng nhập */
export const declineInvitation = asyncHandler(async (req: Request, res: Response) => {
  await farmService.declineInvitation(req.params.token)
  res.json({ success: true, data: { message: 'Đã từ chối lời mời' } })
})

/** POST /farms/:id/houses – FARM-FR-002 */
export const createHouse = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.createHouse(req.params.id, req.user, req.body)
  res.status(201).json({ success: true, data: house })
})

/** GET /farms/:id/houses */
export const listHouses = asyncHandler(async (req: Request, res: Response) => {
  const houses = await farmService.listHouses(req.params.id, req.user)
  res.json({ success: true, data: houses })
})

/** POST /farms/houses/:houseId/zones – FARM-FR-002 */
export const createZone = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.createZone(req.params.houseId, req.user, req.body)
  res.status(201).json({ success: true, data: zone })
})

/** GET /farms/houses/:houseId/zones */
export const listZones = asyncHandler(async (req: Request, res: Response) => {
  const zones = await farmService.listZones(req.params.houseId, req.user)
  res.json({ success: true, data: zones })
})

/** GET /farms/zones/:zoneId – ENV-FR-006, FE lấy thresholds hiện tại trước khi mở form sửa */
export const getZone = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.getZone(req.params.zoneId, req.user)
  res.json({ success: true, data: zone })
})

/** PUT /farms/zones/:zoneId/thresholds – ENV-FR-006 */
export const updateThresholds = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.updateZoneThresholds(req.params.zoneId, req.user, req.body)
  res.json({ success: true, data: zone })
})

/** PUT /farms/zones/:zoneId/fuzzy-tuning – ENV-FR-021 */
export const updateFuzzyTuning = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.updateZoneFuzzyTuning(req.params.zoneId, req.user, req.body)
  res.json({ success: true, data: zone })
})

/** POST /farms/zones/:zoneId/fuzzy-tuning/apply-suggestion – EXPERT-FR-011, BR-22 */
export const applySuggestion = asyncHandler(async (req: Request, res: Response) => {
  const zone = await coefficientProposalService.applySuggestionDirect(req.user, req.params.zoneId)
  res.json({ success: true, data: zone })
})

/** PUT /farms/zones/:zoneId/detection-tuning – EXPERT-FR-008 */
export const updateDetectionTuning = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.updateZoneDetectionTuning(req.params.zoneId, req.user, req.body)
  res.json({ success: true, data: zone })
})

/** PUT /farms/houses/:houseId/bird-count-tuning – EXPERT-FR-008 (SRS v2.1.8) */
export const updateBirdCountTuning = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.updateHouseBirdCountTuning(req.params.houseId, req.user, req.body)
  res.json({ success: true, data: house })
})

/** GET /farms/houses/:houseId/health-levels – ANALYTICS-FR-012, BR-28 */
export const getHealthLevels = asyncHandler(async (req: Request, res: Response) => {
  const data = await farmService.getHouseHealthLevels(req.params.houseId, req.user)
  res.json({ success: true, data })
})

/** PUT /farms/houses/:houseId/health-levels – ANALYTICS-FR-012, BR-22 */
export const updateHealthLevels = asyncHandler(async (req: Request, res: Response) => {
  const data = await farmService.updateHouseHealthLevels(req.params.houseId, req.user, req.body)
  res.json({ success: true, data })
})

/** PUT /farms/zones/:zoneId/thresholds/reset – ENV-FR-020 */
export const resetThresholds = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.resetZoneThresholds(req.params.zoneId, req.user)
  res.json({ success: true, data: zone })
})
