import type { InfiniteData } from '@tanstack/react-query'
import type { ApiResponse, InAppNotification } from '@/types'

// Cache của useNotifications: các trang GET /notifications
export type NotificationPages = InfiniteData<ApiResponse<InAppNotification[]>, unknown>

// Khoá cache hộp thông báo và số chưa đọc — hook đọc, socket và thao tác đọc cùng ghi vào đây
export const NOTIFICATION_LIST_KEY = ['notifications', 'list'] as const
export const NOTIFICATION_UNREAD_KEY = ['notifications', 'unread-count'] as const
// Số cảnh báo chưa xác nhận cho badge (useSyncAlertBadge)
export const ALERT_BADGE_KEY = ['alerts', 'badge'] as const

// Bấm một thông báo thì đi đâu: cảnh báo mở đúng cảnh báo ở tab Cảnh báo, báo cáo mở tab Phân tích, Work Order mở trang chi tiết
// Work Order (G-21), còn lại mở trang chi tiết thông báo
export type NotificationTarget =
  | { kind: 'alert'; alertId: string }
  | { kind: 'report'; reportId: string }
  | { kind: 'workOrder'; workOrderId: string }
  | { kind: 'detail'; notificationId: string }

export function getNotificationTarget(notification: InAppNotification): NotificationTarget {
  if (notification.ref?.kind === 'alert') return { kind: 'alert', alertId: notification.ref.id }
  if (notification.ref?.kind === 'health_report') return { kind: 'report', reportId: notification.ref.id }
  if (notification.ref?.kind === 'work_order') return { kind: 'workOrder', workOrderId: notification.ref.id }
  return { kind: 'detail', notificationId: notification._id }
}

// Thông báo về quyết định của chuyên gia hoặc cảnh báo: trạng thái cảnh báo có thể vừa đổi (bác bỏ → DISMISSED) mà backend
// không gửi sự kiện riêng, nên số và danh sách cảnh báo phải tải lại
export function affectsAlerts(notification: InAppNotification): boolean {
  return notification.ref?.kind === 'expert_decision' || notification.ref?.kind === 'alert'
}

// Tìm một thông báo trong các trang đã tải (backend không có GET /notifications/{id})
export function findNotificationInPages(
  pages: NotificationPages | undefined,
  notificationId: string,
): InAppNotification | null {
  for (const page of pages?.pages ?? []) {
    const found = page.data.find(notification => notification._id === notificationId)
    if (found) return found
  }
  return null
}

// Thông báo mới qua socket: chèn lên đầu trang 1, tăng meta.total để việc tải thêm trang vẫn đúng. Đã có thì giữ nguyên
export function prependNotification(
  pages: NotificationPages | undefined,
  notification: InAppNotification,
): NotificationPages | undefined {
  if (!pages || pages.pages.length === 0) return pages
  if (findNotificationInPages(pages, notification._id)) return pages
  const [firstPage, ...restPages] = pages.pages
  const total = firstPage.meta?.total
  return {
    ...pages,
    pages: [
      {
        ...firstPage,
        data: [notification, ...firstPage.data],
        meta: { ...firstPage.meta, ...(total !== undefined ? { total: total + 1 } : {}) },
      },
      ...restPages,
    ],
  }
}

// Đánh dấu đã đọc trong cache; notificationId null là mọi thông báo
export function markReadInPages(
  pages: NotificationPages | undefined,
  notificationId: string | null,
  readAt: string,
): NotificationPages | undefined {
  if (!pages) return pages
  return {
    ...pages,
    pages: pages.pages.map(page => ({
      ...page,
      data: page.data.map(notification =>
        !notification.read_at && (notificationId === null || notification._id === notificationId)
          ? { ...notification, read_at: readAt }
          : notification,
      ),
    })),
  }
}

// Tập id vừa nhận qua socket để không đếm trùng (sự kiện gửi lại, hoặc đến sau khi danh sách đã tải có dòng đó).
// Giữ tối đa limit id gần nhất; Set giữ thứ tự thêm nên id cũ nhất đứng đầu
export function createRecentIdSet(limit: number) {
  const ids = new Set<string>()
  return {
    has: (id: string) => ids.has(id),
    add: (id: string) => {
      ids.add(id)
      if (ids.size > limit) ids.delete(ids.values().next().value as string)
    },
    clear: () => ids.clear(),
  }
}

// Gộp nhiều lần gọi trong delayMs thành một lần chạy ở cuối: nhiều cảnh báo đến dồn dập chỉ tải lại danh sách một lần
export function createTrailingRunner(run: () => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    schedule: () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        run()
      }, delayMs)
    },
    cancel: () => {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

// Thông báo đẩy (FCM) mang data { kind, id } như ref của thông báo trong app (push.service backend): bấm vào thì mở cùng chỗ
// với bấm thông báo trong chuông. data lạ hoặc thiếu thì mở chuông
export type PushTarget = Exclude<NotificationTarget, { kind: 'detail' }> | { kind: 'bell' }

export function getPushTarget(data: unknown): PushTarget {
  const record = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const id = typeof record.id === 'string' && record.id ? record.id : null
  if (id && record.kind === 'alert') return { kind: 'alert', alertId: id }
  if (id && record.kind === 'health_report') return { kind: 'report', reportId: id }
  if (id && record.kind === 'work_order') return { kind: 'workOrder', workOrderId: id }
  return { kind: 'bell' }
}
