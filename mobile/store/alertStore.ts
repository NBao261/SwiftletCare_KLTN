import { create } from 'zustand'
import type { Alert } from '@/types'

interface AlertState {
  unreadCount: number
  latestAlert: Alert | null
  incrementUnread: () => void
  resetUnread: () => void
  setLatestAlert: (alert: Alert) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  unreadCount: 0,
  latestAlert: null,
  incrementUnread: () => set(s => ({ unreadCount: s.unreadCount + 1 })),
  resetUnread:     () => set({ unreadCount: 0 }),
  setLatestAlert:  (alert) => set({ latestAlert: alert }),
}))
