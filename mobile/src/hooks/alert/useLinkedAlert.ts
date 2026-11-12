import { useEffect } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { useAlertDetail } from '@/hooks/alert/useAlertDetail'
import type { Alert } from '@/types'

// Tab Cảnh báo mở từ chuông hoặc thông báo với param alertId: tải cảnh báo đó rồi mở sheet chi tiết của nó. Xong (hoặc không
// tải được) thì bỏ param, để lần sau quay lại tab không mở lại sheet
export function useLinkedAlert(onOpen: (alert: Alert) => void, onMissing: () => void) {
  const { alertId } = useLocalSearchParams<{ alertId?: string }>()
  const alertQuery = useAlertDetail(alertId ?? null)
  const linkedAlert = alertQuery.data
  const isMissing = alertQuery.isError

  useEffect(() => {
    if (!alertId) return
    if (linkedAlert && linkedAlert._id === alertId) {
      onOpen(linkedAlert)
      router.setParams({ alertId: undefined })
    } else if (isMissing) {
      onMissing()
      router.setParams({ alertId: undefined })
    }
  }, [alertId, linkedAlert, isMissing, onOpen, onMissing])
}
