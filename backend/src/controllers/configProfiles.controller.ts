import { Request, Response } from 'express'
import * as configProfileService from '@/services/configProfile.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /profiles?farmId= – EXPERT-FR-014 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  res.json({ success: true, data: await configProfileService.listProfiles(String(req.query.farmId), req.user, status) })
})

/** GET /profiles/:id – EXPERT-FR-014 */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.getProfile(req.params.id, req.user) })
})

/** POST /profiles – EXPERT-FR-014 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await configProfileService.createProfile(req.body.farm_id, req.user, req.body) })
})

/** PUT /profiles/:id – EXPERT-FR-014 */
export const update = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.updateProfile(req.params.id, req.user, req.body) })
})

/** POST /profiles/:id/approve – EXPERT-FR-014 */
export const approve = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.approveProfile(req.params.id, req.user) })
})

/** POST /profiles/:id/archive – EXPERT-FR-014 */
export const archive = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.archiveProfile(req.params.id, req.user) })
})

/** POST /profiles/:id/apply – EXPERT-FR-015 */
export const apply = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await configProfileService.applyProfile(req.params.id, req.user, req.body.house_ids) })
})
