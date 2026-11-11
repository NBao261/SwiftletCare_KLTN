import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSocketConnection } from '@/hooks/telemetry/useSocketConnection'
import { alertApi } from '@/services/api/alert.api'
import { useAlertStore } from '@/stores/alertStore'
import { ALERT_BADGE_KEY } from '@/utils/notification.utils'

// Socket chạy: cảnh báo mới, phán quyết và lần nối lại cập nhật số ngay (useBellRealtime); nhịp chậm chỉ để bắt các thay đổi
// backend không gửi sự kiện (cảnh báo tự đóng, đồng sở hữu xác nhận ở máy khác). Socket mất: tải lại nhanh hơn. Mỗi lần chỉ
// tải 1 dòng (meta.total), app chạy nền thì dừng (focusManager)
const LIVE_REFRESH_MS = 60 * 1000
const FALLBACK_REFRESH_MS = 30 * 1000

// Badge tab Cảnh báo và mục Cảnh báo của chuông = số cảnh báo ACTIVE (chưa xác nhận) mọi farm, theo meta.total của backend;
// mọi lần tải lại danh sách cảnh báo (khoá bắt đầu bằng 'alerts') cũng tải lại số này
export function useSyncAlertBadge(enabled: boolean) {
  const setUnread = useAlertStore(state => state.setUnread)
  const isSocketConnected = useSocketConnection()
  const badgeQuery = useQuery({
    queryKey: ALERT_BADGE_KEY,
    queryFn: () => alertApi.list({ status: 'ACTIVE', limit: '1' }).then(response => response.data.meta?.total ?? 0),
    enabled,
    refetchInterval: isSocketConnected ? LIVE_REFRESH_MS : FALLBACK_REFRESH_MS,
  })
  const count = badgeQuery.data

  useEffect(() => {
    if (count !== undefined) setUnread(count)
  }, [count, setUnread])
}
