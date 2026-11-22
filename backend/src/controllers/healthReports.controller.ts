import { Request, Response } from 'express'
import * as houseHealthReportService from '@/services/houseHealthReport.service'
import type { HouseReportKind } from '@/models/houseHealthReport.model'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined
  const limit = req.query.limit ? Number(req.query.limit) : undefined
  const result = await houseHealthReportService.listHouseReports(req.user, {
    houseId: req.query.houseId as string | undefined,
    farmId:  req.query.farmId as string | undefined,
    kind:    req.query.kind as HouseReportKind | undefined,
    from:    req.query.from as string | undefined,
    to:      req.query.to as string | undefined,
    // Route đã đổi sang boolean
    hasConclusion: req.query.hasConclusion as unknown as boolean | undefined,
    page, limit,
  })
  res.json({ success: true, data: result.records, meta: { total: result.total, page: result.page, limit: result.limit } })
})

// 201 khi mới, 200 khi đã có cùng khoảng
export const createCustom = asyncHandler(async (req: Request, res: Response) => {
  const { data, created } = await houseHealthReportService.createCustomReport(req.user, {
    houseId: req.body.houseId as string, from: req.body.from as string, to: req.body.to as string,
  })
  res.status(created ? 201 : 200).json({ success: true, data })
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const report = await houseHealthReportService.getReport(req.params.id, req.user)
  res.json({ success: true, data: report })
})

export const setConclusion = asyncHandler(async (req: Request, res: Response) => {
  const report = await houseHealthReportService.setConclusion(req.params.id, req.user, req.body.text as string)
  res.json({ success: true, data: report })
})
