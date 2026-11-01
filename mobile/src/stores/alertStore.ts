import { create } from 'zustand'
import type { Alert } from '@/types'

interface AlertState {
  unreadCount: number
  latestAlert: Alert | null
  incrementUnread: () => void
  resetUnread: () => void
  // Số ACTIVE backend trả (useSyncAlertBadge)
  setUnread: (count: number) => void
  setLatestAlert: (alert: Alert) => void
  // Xoá hết khi kết thúc phiên, không để badge của tài khoản trước sang tài khoản sau
  clearAlerts: () => void
}

// Cảnh báo realtime phía client — số chưa đọc cho badge tab Cảnh báo
export const useAlertStore = create<AlertState>(set => ({
  unreadCount: 0,
  latestAlert: null,
  incrementUnread: () => set(state => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
  setUnread: count => set({ unreadCount: count }),
  setLatestAlert: alert => set({ latestAlert: alert }),
  clearAlerts: () => set({ unreadCount: 0, latestAlert: null }),
}))
