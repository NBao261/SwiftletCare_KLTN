import { Request, Response } from 'express'
import * as analyticsService from '@/services/analytics.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /analytics/env/summary – ANALYTICS-FR-001 (biểu đồ lịch sử môi trường) */
export const envSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getEnvSummary(req.user, {
    zoneId: req.query.zoneId as string,
    range:  (req.query.range as string) ?? '24h',
  })
  res.json({ success: true, data })
})

/** GET /analytics/env/compare – ANALYTICS-FR-005 (so sánh nhiều Zone) */
export const envCompare = asyncHandler(async (req: Request, res: Response) => {
  const zoneIds = String(req.query.zoneIds ?? '').split(',').filter(Boolean)
  const data = await analyticsService.compareZones(req.user, zoneIds, (req.query.range as string) ?? '24h')
  res.json({ success: true, data })
})

/** GET /analytics/bird-count/daily – VISION-FR-008/010 */
export const birdCountDaily = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getBirdCountDaily(req.user, req.query.zoneId as string, {
    from: req.query.from as string | undefined,
    to:   req.query.to as string | undefined,
  })
  res.json({ success: true, data })
})

/** GET /analytics/bird-count/trends – VISION-FR-009/010, ANALYTICS-FR-002 */
export const birdCountTrends = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getBirdCountTrends(req.user, req.query.zoneId as string, {
    days: req.query.days ? Number(req.query.days) : 30,
  })
  res.json({ success: true, data })
})

/** GET /analytics/correlation – ANALYTICS-FR-003 (môi trường vs return rate) */
export const envBirdCorrelation = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getEnvBirdCorrelation(req.user, req.query.zoneId as string, {
    days: req.query.days ? Number(req.query.days) : 30,
  })
  res.json({ success: true, data })
})
