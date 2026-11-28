import { Request, Response } from 'express'
import * as weatherCompensationService from '@/services/weatherCompensation.service'
import * as weatherService from '@/services/weather.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const getRules = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.getWeatherRules(req.params.houseId, req.user) })
})

export const proposeRules = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await weatherCompensationService.proposeWeatherRules(req.params.houseId, req.user, req.body.rules) })
})

export const approveProposal = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.approveWeatherRulesProposal(req.params.houseId, req.user, req.body.proposed_at) })
})

export const rejectProposal = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.rejectWeatherRulesProposal(req.params.houseId, req.user, req.body.note, req.body.proposed_at) })
})

export const setRules = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherCompensationService.setWeatherRules(req.params.houseId, req.user, req.body.rules) })
})

export const getCurrentWeather = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await weatherService.getCurrentWeatherOfHouse(req.params.houseId, req.user) })
})
