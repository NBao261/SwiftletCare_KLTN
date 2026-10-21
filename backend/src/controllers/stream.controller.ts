import { Request, Response } from 'express'
import * as streamService from '@/services/stream.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /devices/camera-nodes/:id/stream-token — VISION-FR-013 */
export const getStreamToken = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await streamService.issueStreamToken(req.params.id, req.user) })
})

/** POST /internal/stream-auth?key= — MediaMTX hỏi quyền đẩy/xem stream */
export const streamAuth = asyncHandler(async (req: Request, res: Response) => {
  streamService.authorizeStream(req.query.key, req.body)
  res.json({ success: true })
})
