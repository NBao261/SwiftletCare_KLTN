import { create } from 'zustand'
import type { Alert } from '@/types'

interface AlertState {
  unreadCount: number
  latestAlert: Alert | null
  incrementUnread: () => void
  /** Trừ ngay 1 khi user tự ack 1 alert từ NotificationPopover — UI phản hồi tức thì,
   *  không đợi refetch `useUnreadAlertCount` (vẫn chạy sau đó để đồng bộ lại số thật). */
  decrementUnread: () => void
  setLatestAlert: (alert: Alert) => void
  resetUnread: () => void
  /** Đồng bộ từ `meta.unreadCount` của GET /alerts (nguồn sự thật — số cảnh báo ACTIVE) */
  setUnreadCount: (n: number) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  unreadCount:  0,
  latestAlert:  null,
  incrementUnread: () => set(s => ({ unreadCount: s.unreadCount + 1 })),
  decrementUnread: () => set(s => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
  setLatestAlert:  (alert) => set({ latestAlert: alert }),
  resetUnread:     () => set({ unreadCount: 0 }),
  setUnreadCount:  (n) => set({ unreadCount: n }),
}))
