import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import { useAlertStore } from '@/stores/alertStore'

const REFRESH_INTERVAL_MS = 30 * 1000

// Badge tab Cảnh báo = số cảnh báo ACTIVE (chưa xác nhận) mọi farm, theo meta.total của backend; mọi lần tải lại danh sách
// cảnh báo (khoá bắt đầu bằng 'alerts') cũng tải lại số này
export function useSyncAlertBadge(enabled: boolean) {
  const setUnread = useAlertStore(state => state.setUnread)
  const badgeQuery = useQuery({
    queryKey: ['alerts', 'badge'],
    queryFn: () => alertApi.list({ status: 'ACTIVE', limit: '1' }).then(response => response.data.meta?.total ?? 0),
    enabled,
    refetchInterval: REFRESH_INTERVAL_MS,
  })
  const count = badgeQuery.data

  useEffect(() => {
    if (count !== undefined) setUnread(count)
  }, [count, setUnread])
}
