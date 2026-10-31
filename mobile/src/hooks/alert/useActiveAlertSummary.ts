import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

// Đếm cảnh báo đang mở theo bộ lọc — chỉ cần meta.total nên tải 1 dòng
function countActiveAlerts(params: Record<string, string> = {}): Promise<number> {
  return alertApi
    .list({ ...params, status: 'ACTIVE', limit: '1' })
    .then(response => response.data.meta?.total ?? 0)
}

// Cảnh báo đang mở của mọi Farm: tổng số và số mức Nghiêm trọng/Cao
export function useActiveAlertSummary() {
  return useQuery({
    queryKey: ['alerts', 'active-summary'],
    queryFn: async () => {
      const [total, critical, high] = await Promise.all([
        countActiveAlerts(),
        countActiveAlerts({ severity: 'CRITICAL' }),
        countActiveAlerts({ severity: 'HIGH' }),
      ])
      return { total, urgent: critical + high }
    },
  })
}
