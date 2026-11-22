import { Request, Response } from 'express'
import * as configProfileService from '@/services/configProfile.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await configProfileService.listProfiles(String(req.query.farmId), req.user, {
    status: req.query.status as string | undefined,
    page:   req.query.page as string | undefined,
    limit:  req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.getProfile(req.params.id, req.user) })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await configProfileService.createProfile(req.body.farm_id, req.user, req.body) })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.updateProfile(req.params.id, req.user, req.body) })
})

export const approve = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.approveProfile(req.params.id, req.user) })
})

export const archive = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.archiveProfile(req.params.id, req.user) })
})

export const apply = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.applyProfile(req.params.id, req.user, req.body.house_ids) })
})
