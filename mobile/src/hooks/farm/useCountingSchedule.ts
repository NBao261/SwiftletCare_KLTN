import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Lịch đếm chim của một nhà, khung đang áp hôm nay và khung mặc định (VISION-FR-019, BR-13)
export function useCountingSchedule(houseId: string) {
  return useQuery({
    queryKey: ['counting-schedule', houseId],
    queryFn: () => farmApi.getCountingSchedule(houseId).then(response => response.data.data),
    enabled: Boolean(houseId),
  })
}
