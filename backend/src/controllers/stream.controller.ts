import { Request, Response } from 'express'
import * as streamService from '@/services/stream.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const getStreamToken = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await streamService.issueStreamToken(req.params.id, req.user) })
})

export const streamAuth = asyncHandler(async (req: Request, res: Response) => {
  await streamService.authorizeStream(req.query.key, req.body)
  res.json({ success: true })
})
