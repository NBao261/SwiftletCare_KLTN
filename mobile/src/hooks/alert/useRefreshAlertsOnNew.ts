import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { offAlertNew, onAlertNew } from '@/services/socket/socketClient'

// Có ALERT_NEW ở các phòng đang theo dõi thì tải lại các danh sách cảnh báo
export function useRefreshAlertsOnNew() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleNew = () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
    onAlertNew(handleNew)
    return () => offAlertNew(handleNew)
  }, [queryClient])
}
