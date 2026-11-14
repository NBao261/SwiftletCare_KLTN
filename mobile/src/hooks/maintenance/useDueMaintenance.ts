import { useQuery } from '@tanstack/react-query'
import { maintenanceApi } from '@/services/api/maintenance.api'

// Kế hoạch bảo trì đến hạn hoặc quá hạn của mọi nhà người dùng được xem, quá hạn trước (OPS-FR-006)
export function useDueMaintenance(enabled = true) {
  return useQuery({
    queryKey: ['maintenance', 'due'],
    queryFn: () => maintenanceApi.listDue().then(response => response.data.data),
    enabled,
  })
}
