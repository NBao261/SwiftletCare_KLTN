import { Request, Response } from 'express'
import * as healthReportService from '@/services/healthReport.service'
import * as houseHealthReportService from '@/services/houseHealthReport.service'
import type { HouseReportKind } from '@/models/houseHealthReport.model'
import { asyncHandler } from '@/utils/asyncHandler.util'

/**
 * GET /health-reports – EXPERT-FR-005. `houseId`/`farmId`: báo cáo theo nhà; `zoneId` (kiểu cũ, deprecated):
 * báo cáo tuần theo Zone cho các màn hiện có.
 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined
  const limit = req.query.limit ? Number(req.query.limit) : undefined
  const result = req.query.zoneId
    ? await healthReportService.listHealthReports(req.user, { zoneId: req.query.zoneId as string, page, limit })
    : await houseHealthReportService.listHouseReports(req.user, {
      houseId: req.query.houseId as string | undefined,
      farmId:  req.query.farmId as string | undefined,
      kind:    req.query.kind as HouseReportKind | undefined,
      from:    req.query.from as string | undefined,
      to:      req.query.to as string | undefined,
      page, limit,
    })
  res.json({ success: true, data: result.records, meta: { total: result.total, page: result.page, limit: result.limit } })
})

/** POST /health-reports – EXPERT-FR-005: báo cáo theo yêu cầu, 201 khi mới, 200 khi đã có cùng khoảng */
export const createCustom = asyncHandler(async (req: Request, res: Response) => {
  const { data, created } = await houseHealthReportService.createCustomReport(req.user, {
    houseId: req.body.houseId as string, from: req.body.from as string, to: req.body.to as string,
  })
  res.status(created ? 201 : 200).json({ success: true, data })
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
  const report = await houseHealthReportService.getReport(req.params.id, req.user)
  res.json({ success: true, data: report })
})

/** PUT /health-reports/:id/conclusion – EXPERT-FR-006 */
export const setConclusion = asyncHandler(async (req: Request, res: Response) => {
  const report = await houseHealthReportService.setConclusion(req.params.id, req.user, req.body.text as string)
  res.json({ success: true, data: report })
})
