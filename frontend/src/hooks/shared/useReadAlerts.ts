import { useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useReadAlertStore } from '@/stores/readAlertStore'

const NO_READS: string[] = []

// Tập cảnh báo người dùng hiện tại đã đọc + hàm đánh dấu đã đọc
export function useReadAlerts() {
  const userId = useAuthStore(s => s.user?._id) ?? ''
  const ids = useReadAlertStore(s => s.readByUser[userId]) ?? NO_READS
  const markInStore = useReadAlertStore(s => s.markRead)

  const readIds = useMemo(() => new Set(ids), [ids])
  const markRead = useCallback((alertId: string) => { if (userId) markInStore(userId, alertId) }, [userId, markInStore])
  return { readIds, markRead }
}
