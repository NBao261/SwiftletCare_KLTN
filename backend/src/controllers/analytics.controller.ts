import { Request, Response, NextFunction } from 'express'
import * as analyticsService from '@/services/analytics.service'

/** GET /analytics/env/summary – ANALYTICS-FR-001 (biểu đồ lịch sử môi trường) */
export async function envSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getEnvSummary(req.user, {
      zoneId: req.query.zoneId as string,
      range:  (req.query.range as string) ?? '24h',
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

/** GET /analytics/env/compare – ANALYTICS-FR-005 (so sánh nhiều Zone) */
export async function envCompare(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const zoneIds = String(req.query.zoneIds ?? '').split(',').filter(Boolean)
    const data = await analyticsService.compareZones(req.user, zoneIds, (req.query.range as string) ?? '24h')
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

/** GET /analytics/bird-count/daily – VISION-FR-008/010 */
export async function birdCountDaily(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getBirdCountDaily(req.user, req.query.zoneId as string, {
      from: req.query.from as string | undefined,
      to:   req.query.to as string | undefined,
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

/** GET /analytics/bird-count/trends – VISION-FR-009/010, ANALYTICS-FR-002 */
export async function birdCountTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getBirdCountTrends(req.user, req.query.zoneId as string, {
      days: req.query.days ? Number(req.query.days) : 30,
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

/** GET /analytics/correlation – ANALYTICS-FR-003 (môi trường vs return rate) */
export async function envBirdCorrelation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getEnvBirdCorrelation(req.user, req.query.zoneId as string, {
      days: req.query.days ? Number(req.query.days) : 30,
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}
