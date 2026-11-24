import { Request, Response } from 'express'
import * as audioTrackService from '@/services/audioTrack.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const uploadTrack = asyncHandler(async (req: Request, res: Response) => {
  const track = await audioTrackService.uploadTrack(req.params.id, req.user, {
    file: req.file, track_number: req.body.track_number, display_name: req.body.display_name,
  })
  res.status(201).json({ success: true, data: track })
})

export const listTracks = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await audioTrackService.listTracks(req.params.id, req.user) })
})

export const setSyncStatus = asyncHandler(async (req: Request, res: Response) => {
  const track = await audioTrackService.setSyncStatus(req.params.id, req.params.trackId, req.user, req.body.synced_to_sd)
  res.json({ success: true, data: track })
})

export const selectTrack = asyncHandler(async (req: Request, res: Response) => {
  const node = await audioTrackService.selectTrack(req.params.id, req.params.trackId, req.user)
  res.json({ success: true, data: node })
})

export const playNow = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await audioTrackService.playNow(req.params.id, req.params.trackId, req.user) })
})

export const stopPlayback = asyncHandler(async (req: Request, res: Response) => {
  await audioTrackService.stopPlayback(req.params.id, req.user)
  res.json({ success: true })
})

export const deleteTrack = asyncHandler(async (req: Request, res: Response) => {
  await audioTrackService.deleteTrack(req.params.id, req.params.trackId, req.user)
  res.json({ success: true })
})
