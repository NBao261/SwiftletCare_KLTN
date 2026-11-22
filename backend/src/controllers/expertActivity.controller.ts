import { Request, Response } from 'express'
import * as expertActivityService from '@/services/expertActivity.service'
import * as expertReviewService from '@/services/expertReview.service'
import * as coefficientProposalService from '@/services/coefficientProposal.service'
import * as expertReminderService from '@/services/expertReminder.service'
import type { ReminderKind } from '@/services/expertReminder.service'
import type { ExpertDecisionAction } from '@/services/expertActivity.service'
import type { ParameterReviewStatus } from '@/models/parameterReview.model'
import type { CoefficientProposalStatus } from '@/models/coefficientProposal.model'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await expertActivityService.listExpertActivity(req.user, {
    farmId:  req.query.farmId as string,
    from:    req.query.from as string | undefined,
    to:      req.query.to as string | undefined,
    type:    req.query.type as ExpertDecisionAction | undefined,
    zoneId:  req.query.zoneId as string | undefined,
    houseId: req.query.houseId as string | undefined,
    page:    req.query.page as string | undefined,
    limit:   req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const listReviews = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await expertReviewService.listReviews(req.user, {
    farmId: req.query.farmId as string,
    zoneId: req.query.zoneId as string | undefined,
    status: req.query.status as ParameterReviewStatus | undefined,
    page:   req.query.page as string | undefined,
    limit:  req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const acceptReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await expertReviewService.acceptReview(req.params.id, req.user)
  res.json({ success: true, data: review })
})

export const revertReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await expertReviewService.revertReview(req.params.id, req.user)
  res.json({ success: true, data: review })
})

export const listProposals = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await coefficientProposalService.listProposals(req.user, {
    farmId: req.query.farmId as string,
    zoneId: req.query.zoneId as string | undefined,
    status: req.query.status as CoefficientProposalStatus | undefined,
    page:   req.query.page as string | undefined,
    limit:  req.query.limit as string | undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

export const submitProposal = asyncHandler(async (req: Request, res: Response) => {
  const proposal = await coefficientProposalService.submitProposal(req.user, req.body.zoneId as string)
  res.status(201).json({ success: true, data: proposal })
})

export const approveProposal = asyncHandler(async (req: Request, res: Response) => {
  const proposal = await coefficientProposalService.approveProposal(req.params.id, req.user)
  res.json({ success: true, data: proposal })
})

export const rejectProposal = asyncHandler(async (req: Request, res: Response) => {
  const proposal = await coefficientProposalService.rejectProposal(req.params.id, req.user, req.body.note as string)
  res.json({ success: true, data: proposal })
})

export const remindExpert = asyncHandler(async (req: Request, res: Response) => {
  const data = await expertReminderService.remindExpert(req.user, req.body.kind as ReminderKind, req.body.id)
  res.status(201).json({ success: true, data })
})
