import { Request, Response } from 'express'
import * as alertService from '@/services/alert.service'
import * as alertEvidenceService from '@/services/alertEvidence.service'
import { recomputeForAlert } from '@/services/healthAssessment.service'
import type { AlertVerdictResult } from '@/types'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /alerts – ALERT-FR-007 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit, unreadCount } = await alertService.listAlerts(req.user, {
    farmId:   req.query.farmId as string | undefined,
    zoneId:   req.query.zoneId as string | undefined,
    houseId:  req.query.houseId as string | undefined,
    status:   req.query.status as string | undefined,
    severity: req.query.severity as string | undefined,
    type:     req.query.type as string | undefined,
    verdict:  req.query.verdict as 'pending' | 'confirmed' | 'rejected' | undefined,
    page:     req.query.page ? Number(req.query.page) : undefined,
    limit:    req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit, unreadCount } })
})

/** GET /alerts/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.getAlert(req.params.id, req.user)
  res.json({ success: true, data: alert })
})

/** PUT /alerts/:id/acknowledge – ALERT-FR-009 */
export const acknowledge = asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.acknowledgeAlert(req.params.id, req.user, req.body.note as string | undefined)
  res.json({ success: true, data: alert })
})

/** PUT /alerts/:id/verdict – EXPERT-FR-003 (Domain Expert xác nhận/bác bỏ cảnh báo suy luận) */
export const setVerdict = asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertService.setAlertVerdict(
    req.params.id, req.user, req.body.result as AlertVerdictResult, req.body.note as string | undefined,
  )
  // SM-17 — NOISE_ANOMALY bị bác bỏ / xác nhận lại đổi chỉ số tiếng ồn của ngày (BR-28)
  await recomputeForAlert(alert)
  res.json({ success: true, data: alert })
})

/** GET /alerts/verdict-stats – EXPERT-FR-003 (tỷ lệ được xác nhận theo từng loại) */
export const verdictStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await alertService.getVerdictStats(req.user, {
    farmId: req.query.farmId as string | undefined,
    zoneId: req.query.zoneId as string | undefined,
  })
  res.json({ success: true, data: stats })
})

/** GET /alerts/:id/evidence – ALERT-FR-014 (dữ liệu quanh cảnh báo suy luận) */
export const evidence = asyncHandler(async (req: Request, res: Response) => {
  const data = await alertEvidenceService.getAlertEvidence(req.params.id, req.user)
  res.json({ success: true, data })
})
