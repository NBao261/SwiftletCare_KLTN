import { useQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'
import type { MyRatingState } from '@/types'

// Các ngày của một nhà trong khoảng from…to (YYYY-MM-DD giờ Việt Nam, tối đa 31 ngày), mới nhất trước (ANALYTICS-FR-012);
// myRatingState lọc theo trạng thái chấm của chính người dùng
export function useHealthDays(houseId: string, from: string, to: string, myRatingState?: MyRatingState) {
  return useQuery({
    queryKey: ['health-days', 'house', houseId, from, to, myRatingState ?? 'all'],
    queryFn: () =>
      healthReportApi.listDays({ houseId, from, to, myRatingState }).then(response => response.data.data),
    enabled: Boolean(houseId),
  })
}
