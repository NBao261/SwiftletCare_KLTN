import { useQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'

// Một ngày của một nhà: đủ trạng thái, lý do, chỉ số và đánh giá, kể cả khi người dùng chưa chấm (BR-31)
export function useHealthDay(dayId: string) {
  return useQuery({
    queryKey: ['health-days', 'detail', dayId],
    queryFn: () => healthReportApi.getDay(dayId).then(response => response.data.data),
    enabled: Boolean(dayId),
  })
}
