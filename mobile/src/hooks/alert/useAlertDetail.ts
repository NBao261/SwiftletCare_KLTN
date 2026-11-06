import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

// Một cảnh báo theo id — dùng chung cho sheet chi tiết và route alert/[alertId]
export function useAlertDetail(alertId: string | null) {
  return useQuery({
    queryKey: ['alerts', 'detail', alertId],
    queryFn: () => alertApi.getDetail(alertId as string).then(response => response.data.data),
    enabled: Boolean(alertId),
  })
}
