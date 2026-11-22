import { Request, Response } from 'express'
import * as healthDayService from '@/services/healthDay.service'
import { asyncHandler } from '@/utils/asyncHandler.util'
import type { ReasonLang } from '@/utils/healthReason.util'
import type { FarmMemberRole, HealthRatingState, HealthRatingValue } from '@/types'

const scope = (req: Request) => ({
  houseId: req.query.houseId as string | undefined,
  farmId:  req.query.farmId as string | undefined,
  from:    req.query.from as string | undefined,
  to:      req.query.to as string | undefined,
})

export const listDays = asyncHandler(async (req: Request, res: Response) => {
  const data = await healthDayService.listHealthDays(req.user, {
    ...scope(req), myRatingState: req.query.myRatingState as HealthRatingState | undefined,
  })
  res.json({ success: true, data })
})

export const exportCsv = asyncHandler(async (req: Request, res: Response) => {
  const csv = await healthDayService.healthDaysCsv(req.user, scope(req), (req.query.lang as ReasonLang | undefined) ?? 'vi')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="health-days.csv"')
  res.send(csv)
})

export const getDay = asyncHandler(async (req: Request, res: Response) => {
  const data = await healthDayService.getHealthDay(req.params.dayId, req.user)
  res.json({ success: true, data })
})

export const rate = asyncHandler(async (req: Request, res: Response) => {
  const data = await healthDayService.rateHealthDay(req.params.dayId, req.user, req.body.rating as HealthRatingValue, req.body.note as string | undefined)
  res.status(201).json({ success: true, data })
})

export const skip = asyncHandler(async (req: Request, res: Response) => {
  const data = await healthDayService.skipHealthDay(req.params.dayId, req.user)
  res.status(201).json({ success: true, data })
})

export const addNote = asyncHandler(async (req: Request, res: Response) => {
  const data = await healthDayService.addRatingNote(req.params.dayId, req.user, req.body.note as string)
  res.json({ success: true, data })
})

export const disagreements = asyncHandler(async (req: Request, res: Response) => {
  const data = await healthDayService.listDisagreements(req.user, scope(req))
  res.json({ success: true, data })
})

export const evaluation = asyncHandler(async (req: Request, res: Response) => {
  const data = await healthDayService.evaluateRatings(req.user, { ...scope(req), role: req.query.role as FarmMemberRole | undefined })
  res.json({ success: true, data })
})
