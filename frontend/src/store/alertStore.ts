import { create } from 'zustand'
import type { Alert } from '@/types'

interface AlertState {
  unreadCount: number
  latestAlert: Alert | null
  incrementUnread: () => void
  setLatestAlert: (alert: Alert) => void
  resetUnread: () => void
}

export const useAlertStore = create<AlertState>((set) => ({
  unreadCount:  0,
  latestAlert:  null,
  incrementUnread: () => set(s => ({ unreadCount: s.unreadCount + 1 })),
  setLatestAlert:  (alert) => set({ latestAlert: alert }),
  resetUnread:     () => set({ unreadCount: 0 }),
}))
