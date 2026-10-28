import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

// Danh sách cảnh báo theo bộ lọc
export function useAlerts(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => alertApi.list(params).then(response => response.data),
  })
}
