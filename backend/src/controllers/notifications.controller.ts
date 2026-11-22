import { Request, Response } from 'express'
import * as notificationService from '@/services/notification.service'
import * as pushService from '@/services/push.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit, unreadCount } = await notificationService.listNotifications(req.user, {
    unread: req.query.unread === 'true',
    page:   req.query.page ? Number(req.query.page) : undefined,
    limit:  req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit, unreadCount } })
})

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await notificationService.markNotificationRead(req.params.id, req.user)
  res.json({ success: true, data: notification })
})

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.markAllNotificationsRead(req.user)
  res.json({ success: true, data })
})

export const registerPushToken = asyncHandler(async (req: Request, res: Response) => {
  await pushService.registerPushToken(req.user._id, req.body.token as string, req.body.platform)
  res.json({ success: true, data: { registered: true } })
})

export const removePushToken = asyncHandler(async (req: Request, res: Response) => {
  await pushService.removePushToken(req.user._id, req.body.token as string)
  res.json({ success: true, data: { registered: false } })
})
