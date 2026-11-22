import { Request, Response } from 'express'
import * as alertService from '@/services/alert.service'
import * as alertEvidenceService from '@/services/alertEvidence.service'
import * as onsiteCheckService from '@/services/onsiteCheck.service'
import type { OnsiteObservation } from '@/models/alert.model'
import type { SiteCause } from '@/models/workOrder.model'
import { recomputeForAlert } from '@/services/healthAssessment.service'
import type { AlertVerdictResult } from '@/types'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit, unreadCount } = await alertService.listAlerts(req.user, {
    farmId:   req.query.farmId as string | undefined,
    zoneId:   req.query.zoneId as string | undefined,
    houseId:  req.query.houseId as string | undefined,
    status:   req.query.status as string | undefined,
    open:     req.query.open === 'true',
    severity: req.query.severity as string | undefined,
    type:     req.query.type as string | undefined,
    verdict:  req.query.verdict as 'any' | 'pending' | 'confirmed' | 'rejected' | undefined,
    page:     req.query.page ? Number(req.query.page) : undefined,
    limit:    req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit, unreadCount } })
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.getAlertDetail(req.params.id, req.user)
  res.json({ success: true, data: alert })
})

export const acknowledge = asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.acknowledgeAlert(
    req.params.id, req.user, req.body.note as string | undefined, req.body.cause as SiteCause | undefined,
  )
  res.json({ success: true, data: alert })
})

export const setVerdict = asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.setAlertVerdict(
    req.params.id, req.user, req.body.result as AlertVerdictResult, req.body.note as string | undefined,
    req.body.needs_visit === true,
  )
  // kết luận NOISE_ANOMALY đổi chỉ số tiếng ồn của ngày
  await recomputeForAlert(alert)
  res.json({ success: true, data: alert })
})

export const answerOnsiteCheck = asyncHandler(async (req: Request, res: Response) => {
  const alert = await onsiteCheckService.answerOnsiteCheck(req.params.id, req.user, {
    observation: req.body.observation as OnsiteObservation,
    note: req.body.note as string | undefined,
  }, req.file)
  res.json({ success: true, data: alert })
})

export const verdictStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await alertService.getVerdictStats(req.user, {
    farmId: req.query.farmId as string | undefined,
    zoneId: req.query.zoneId as string | undefined,
  })
  res.json({ success: true, data: stats })
})

export const evidence = asyncHandler(async (req: Request, res: Response) => {
  const data = await alertEvidenceService.getAlertEvidence(req.params.id, req.user)
  res.json({ success: true, data })
})
