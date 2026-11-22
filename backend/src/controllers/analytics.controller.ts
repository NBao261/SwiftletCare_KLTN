import { Request, Response } from 'express'
import * as analyticsService from '@/services/analytics.service'
import * as birdCountService from '@/services/birdCount.service'
import * as energyService from '@/services/energy.service'
import * as forecastService from '@/services/forecast.service'
import * as tuningSuggestionService from '@/services/tuningSuggestion.service'
import { asyncHandler } from '@/utils/asyncHandler.util'
import { parsePeriodParam } from '@/utils/period.util'

export const envSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getEnvSummary(req.user, {
    zoneId: req.query.zoneId as string,
    range:  (req.query.range as string) ?? '24h',
  })
  res.json({ success: true, data })
})

export const controlPerformance = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getControlPerformance(req.user, {
    zoneId: req.query.zoneId as string,
    range:  (req.query.range as string) ?? '24h',
  })
  res.json({ success: true, data })
})

export const autonomy = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getAutonomy(req.user, {
    zoneId: req.query.zoneId as string,
    range:  (req.query.range as string) ?? '24h',
  })
  res.json({ success: true, data })
})

export const tuningSuggestion = asyncHandler(async (req: Request, res: Response) => {
  const data = await tuningSuggestionService.getTuningSuggestion(req.user, req.query.zoneId as string)
  res.json({ success: true, data })
})

export const forecast = asyncHandler(async (req: Request, res: Response) => {
  const data = await forecastService.getZoneForecast(req.user, req.query.zoneId as string)
  res.json({ success: true, data })
})

export const envCompare = asyncHandler(async (req: Request, res: Response) => {
  const zoneIds = String(req.query.zoneIds ?? '').split(',').filter(Boolean)
  const data = await analyticsService.compareZones(req.user, zoneIds, (req.query.range as string) ?? '24h')
  res.json({ success: true, data })
})

const birdScope = (req: Request) => ({
  houseId: req.query.houseId as string | undefined,
  zoneId:  req.query.zoneId as string | undefined,
})

export const birdCountDaily = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getBirdCountDaily(req.user, birdScope(req), {
    from: req.query.from as string | undefined,
    to:   req.query.to as string | undefined,
  })
  res.json({ success: true, data })
})

export const birdCountTrends = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getBirdCountTrends(req.user, birdScope(req), {
    days: req.query.days ? Number(req.query.days) : 30,
  })
  res.json({ success: true, data })
})

export const birdCountCurrent = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await birdCountService.getCurrentBirdCount(req.user, birdScope(req)) })
})

export const birdCountBuckets = asyncHandler(async (req: Request, res: Response) => {
  const data = await birdCountService.getBirdCountBuckets(req.user, birdScope(req), {
    from: req.query.from as string | undefined,
    to:   req.query.to as string | undefined,
  })
  res.json({ success: true, data })
})

export const envBirdCorrelation = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getEnvBirdCorrelation(req.user, req.query.zoneId as string, {
    days: req.query.days ? Number(req.query.days) : 30,
  })
  res.json({ success: true, data })
})

/** Telemetry chỉ giữ 90 ngày (BR-36) */
const DEFAULT_ENERGY_DAYS = 90

export const energy = asyncHandler(async (req: Request, res: Response) => {
  const to = parsePeriodParam(req.query.to) ?? new Date()
  const from = parsePeriodParam(req.query.from) ?? new Date(to.getTime() - DEFAULT_ENERGY_DAYS * 86_400_000)
  res.json({ success: true, data: await energyService.getHouseEnergy(req.user, { houseId: req.query.houseId as string, from, to }) })
})
