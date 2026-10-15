import { Request, Response } from 'express'
import * as healthReportService from '@/services/healthReport.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /health-reports – EXPERT-FR-005 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await healthReportService.listHealthReports(req.user, {
    zoneId: req.query.zoneId as string,
    page:   req.query.page ? Number(req.query.page) : undefined,
    limit:  req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** GET /health-reports/preview – EXPERT-FR-005 (xem theo khoảng bất kỳ, không lưu) */
export const preview = asyncHandler(async (req: Request, res: Response) => {
  const data = await healthReportService.previewHealthReport(req.user, {
    zoneId: req.query.zoneId as string,
    from:   req.query.from as string,
    to:     req.query.to as string | undefined,
  })
  res.json({ success: true, data })
})

/** GET /health-reports/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const report = await healthReportService.getHealthReport(req.params.id, req.user)
  res.json({ success: true, data: report })
})

/** PUT /health-reports/:id/conclusion – EXPERT-FR-006 */
export const setConclusion = asyncHandler(async (req: Request, res: Response) => {
  const report = await healthReportService.setReportConclusion(req.params.id, req.user, req.body.text as string)
  res.json({ success: true, data: report })
})
