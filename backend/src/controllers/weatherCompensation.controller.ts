import { Request, Response } from 'express'
import * as weatherCompensationService from '@/services/weatherCompensation.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /farms/houses/:houseId/weather-rules – ENV-FR-030 */
export const getRules = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.getWeatherRules(req.params.houseId, req.user) })
})

/** POST /farms/houses/:houseId/weather-rules/proposal – BR-22, BR-38: Farm Owner gửi bộ luật để chuyên gia duyệt */
export const proposeRules = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await weatherCompensationService.proposeWeatherRules(req.params.houseId, req.user, req.body.rules) })
})

/** POST /farms/houses/:houseId/weather-rules/proposal/approve – chuyên gia duyệt, luật có hiệu lực */
export const approveProposal = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.approveWeatherRulesProposal(req.params.houseId, req.user) })
})

/** POST /farms/houses/:houseId/weather-rules/proposal/reject – chuyên gia từ chối kèm lý do */
export const rejectProposal = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.rejectWeatherRulesProposal(req.params.houseId, req.user, req.body.note) })
})

/** PUT /farms/houses/:houseId/weather-rules – ENV-FR-030 */
export const setRules = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.setWeatherRules(req.params.houseId, req.user, req.body.rules) })
})
