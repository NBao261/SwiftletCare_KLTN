import { Request, Response } from 'express'
import * as weatherCompensationService from '@/services/weatherCompensation.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /farms/houses/:houseId/weather-rules – ENV-FR-030 */
export const getRules = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.getWeatherRules(req.params.houseId, req.user) })
})

/** PUT /farms/houses/:houseId/weather-rules – ENV-FR-030 */
export const setRules = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.setWeatherRules(req.params.houseId, req.user, req.body.rules) })
})
