import { Request, Response } from 'express'
import * as notificationService from '@/services/notification.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /notifications – EXPERT-FR-006/007 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit, unreadCount } = await notificationService.listNotifications(req.user, {
    unread: req.query.unread === 'true',
    page:   req.query.page ? Number(req.query.page) : undefined,
    limit:  req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit, unreadCount } })
})

/** PUT /notifications/:id/read */
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await notificationService.markNotificationRead(req.params.id, req.user)
  res.json({ success: true, data: notification })
})

/** PUT /notifications/read-all */
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.markAllNotificationsRead(req.user)
  res.json({ success: true, data })
})
