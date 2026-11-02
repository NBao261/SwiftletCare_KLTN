import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

// Số cảnh báo đang mở của cả Farm — chỉ cần meta.total nên tải 1 dòng
export function useActiveAlertCount(farmId: string) {
  return useQuery({
    queryKey: ['alerts', 'active-count', farmId],
    queryFn: () =>
      alertApi.list({ farmId, status: 'ACTIVE', limit: '1' }).then(response => response.data.meta?.total ?? 0),
    enabled: Boolean(farmId),
  })
}
