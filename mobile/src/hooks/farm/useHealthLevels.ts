import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Mức chỉ số sức khỏe của một nhà (BR-28) và quyền sửa backend trả về (can_edit, BR-22)
export function useHealthLevels(houseId: string, enabled = true) {
  return useQuery({
    queryKey: ['health-levels', houseId],
    queryFn: () => farmApi.getHealthLevels(houseId).then(response => response.data.data),
    enabled: enabled && Boolean(houseId),
  })
}
