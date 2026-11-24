import { Request, Response } from 'express'
import * as farmService from '@/services/farm.service'
import * as coefficientProposalService from '@/services/coefficientProposal.service'
import * as countingScheduleService from '@/services/countingSchedule.service'
import * as farmOverviewService from '@/services/farmOverview.service'
import * as houseComparisonService from '@/services/houseComparison.service'
import type { ComparisonSortKey } from '@/services/houseComparison.service'
import { asyncHandler } from '@/utils/asyncHandler.util'
import { parsePeriodParam } from '@/utils/period.util'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const farms = await farmService.listFarms(req.user)
  res.json({ success: true, data: farms })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.createFarm(req.user, req.body)
  res.status(201).json({ success: true, data: farm })
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.getFarm(req.params.id, req.user)
  res.json({ success: true, data: farm })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.updateFarm(req.params.id, req.user, req.body)
  res.json({ success: true, data: farm })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await farmService.removeFarm(req.params.id, req.user)
  res.json({ success: true, data: { message: 'Đã xoá trang trại' } })
})

export const inviteMember = asyncHandler(async (req: Request, res: Response) => {
  const invitation = await farmService.inviteMember(req.params.id, req.user, {
    email:    req.body.email as string,
    role:     req.body.role,
  })
  res.status(201).json({ success: true, data: invitation })
})

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const farm = await farmService.removeMember(req.params.id, req.user, req.params.userId)
  res.json({ success: true, data: farm })
})

export const listInvitations = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await farmService.listInvitations(req.params.id, req.user, {
    status: req.query.status as farmService.InvitationStatus | undefined,
    page: req.query.page as string | undefined,
    limit: req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const getInvitation = asyncHandler(async (req: Request, res: Response) => {
  const result = await farmService.getInvitationByToken(req.params.token)
  res.json({ success: true, data: result })
})

export const acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
  const result = await farmService.acceptInvitation(req.params.token, req.user)
  res.json({ success: true, data: result })
})

export const createAccountFromInvitation = asyncHandler(async (req: Request, res: Response) => {
  const user = await farmService.createAccountFromInvitation(req.params.token, req.body)
  res.status(201).json({ success: true, data: user })
})

export const declineInvitation = asyncHandler(async (req: Request, res: Response) => {
  await farmService.declineInvitation(req.params.token)
  res.json({ success: true, data: { message: 'Đã từ chối lời mời' } })
})

export const createHouse = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.createHouse(req.params.id, req.user, req.body)
  res.status(201).json({ success: true, data: house })
})

export const listHouses = asyncHandler(async (req: Request, res: Response) => {
  const houses = await farmService.listHouses(req.params.id, req.user)
  res.json({ success: true, data: houses })
})

export const createZone = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.createZone(req.params.houseId, req.user, req.body)
  res.status(201).json({ success: true, data: zone })
})

export const updateHouse = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.updateHouse(req.params.houseId, req.user, req.body)
  res.json({ success: true, data: house })
})

export const deleteHouse = asyncHandler(async (req: Request, res: Response) => {
  await farmService.deleteHouse(req.params.houseId, req.user)
  res.json({ success: true })
})

export const updateZone = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.updateZone(req.params.zoneId, req.user, req.body)
  res.json({ success: true, data: zone })
})

export const deleteZone = asyncHandler(async (req: Request, res: Response) => {
  await farmService.deleteZone(req.params.zoneId, req.user)
  res.json({ success: true })
})

export const assignTechnician = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.assignTechnician(req.params.houseId, req.user, req.params.userId, req.body?.primary === true)
  res.json({ success: true, data: house })
})

export const getRoster = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await farmService.getRoster(req.params.houseId, req.user) })
})

export const setRoster = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await farmService.setRoster(req.params.houseId, req.user, req.body.shifts) })
})

export const unassignTechnician = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.unassignTechnician(req.params.houseId, req.user, req.params.userId)
  res.json({ success: true, data: house })
})

export const listZones = asyncHandler(async (req: Request, res: Response) => {
  const zones = await farmService.listZones(req.params.houseId, req.user)
  res.json({ success: true, data: zones })
})

export const getZone = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.getZone(req.params.zoneId, req.user)
  res.json({ success: true, data: zone })
})

export const updateThresholds = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.updateZoneThresholds(req.params.zoneId, req.user, req.body)
  res.json({ success: true, data: zone })
})

export const updateFuzzyTuning = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.updateZoneFuzzyTuning(req.params.zoneId, req.user, req.body)
  res.json({ success: true, data: zone })
})

export const applySuggestion = asyncHandler(async (req: Request, res: Response) => {
  const zone = await coefficientProposalService.applySuggestionDirect(req.user, req.params.zoneId)
  res.json({ success: true, data: zone })
})

export const updateDetectionTuning = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.updateZoneDetectionTuning(req.params.zoneId, req.user, req.body)
  res.json({ success: true, data: zone })
})

export const updateBirdCountTuning = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.updateHouseBirdCountTuning(req.params.houseId, req.user, req.body)
  res.json({ success: true, data: house })
})

export const resetDetectionTuning = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.resetZoneDetectionTuning(req.params.zoneId, req.user)
  res.json({ success: true, data: zone })
})

export const resetBirdCountTuning = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.resetHouseBirdCountTuning(req.params.houseId, req.user)
  res.json({ success: true, data: house })
})

export const getCountingSchedule = asyncHandler(async (req: Request, res: Response) => {
  const schedule = await countingScheduleService.getCountingSchedule(req.params.houseId, req.user)
  res.json({ success: true, data: schedule })
})

export const updateCountingSchedule = asyncHandler(async (req: Request, res: Response) => {
  const schedule = await countingScheduleService.updateCountingSchedule(req.params.houseId, req.user, req.body)
  res.json({ success: true, data: schedule })
})

export const getHealthLevels = asyncHandler(async (req: Request, res: Response) => {
  const data = await farmService.getHouseHealthLevels(req.params.houseId, req.user)
  res.json({ success: true, data })
})

export const setHouseStage = asyncHandler(async (req: Request, res: Response) => {
  const house = await farmService.setHouseStage(req.params.houseId, req.user, req.body.stage)
  res.json({ success: true, data: house })
})

export const updateHealthLevels = asyncHandler(async (req: Request, res: Response) => {
  const data = await farmService.updateHouseHealthLevels(req.params.houseId, req.user, req.body)
  res.json({ success: true, data })
})

export const resetThresholds = asyncHandler(async (req: Request, res: Response) => {
  const zone = await farmService.resetZoneThresholds(req.params.zoneId, req.user)
  res.json({ success: true, data: zone })
})

const DEFAULT_COMPARISON_DAYS = 30

export const overview = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await farmOverviewService.getFarmOverview(req.user, req.params.id) })
})

export const comparison = asyncHandler(async (req: Request, res: Response) => {
  const to = parsePeriodParam(req.query.to) ?? new Date()
  const from = parsePeriodParam(req.query.from) ?? new Date(to.getTime() - DEFAULT_COMPARISON_DAYS * 86_400_000)
  const data = await houseComparisonService.getHouseComparison(req.user, {
    farmId: req.params.id, from, to,
    sort: req.query.sort as ComparisonSortKey | undefined,
    order: req.query.order as 'asc' | 'desc' | undefined,
  })
  res.json({ success: true, data })
})
