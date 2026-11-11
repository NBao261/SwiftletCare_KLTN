import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAlertQueries } from '@/config/queryClient'
import { offAlertNew, onAlertNew } from '@/services/socket/socketClient'

// Có ALERT_NEW ở các phòng đang theo dõi thì tải lại các danh sách cảnh báo
export function useRefreshAlertsOnNew() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleNew = () => invalidateAlertQueries(queryClient)
    onAlertNew(handleNew)
    return () => offAlertNew(handleNew)
  }, [queryClient])
}
