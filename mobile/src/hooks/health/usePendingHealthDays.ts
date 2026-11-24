import { useQueries } from '@tanstack/react-query'
import { useFarms } from '@/hooks/farm/useFarms'
import { healthReportApi } from '@/services/api/healthReport.api'
import type { HouseHealthDay } from '@/types'
import { getPendingRatingRange } from '@/utils/healthDay.utils'

// Các ngày đang chờ người dùng chấm ở mọi farm (MF-06, BR-31): mỗi farm một lần gọi, chỉ trong hạn chấm 7 ngày
export function usePendingHealthDays() {
  const farmsQuery = useFarms()
  const farmIds = (farmsQuery.data?.data ?? []).map(farm => farm._id)
  const { from, to } = getPendingRatingRange()

  return useQueries({
    queries: farmIds.map(farmId => ({
      queryKey: ['health-days', 'pending', farmId, from, to],
      queryFn: () =>
        healthReportApi
          .listDays({ farmId, from, to, myRatingState: 'PENDING' })
          .then(response => response.data.data),
    })),
    combine: (results): { data: HouseHealthDay[]; isLoading: boolean; isError: boolean } => ({
      data: results.flatMap(result => result.data ?? []),
      isLoading: farmsQuery.isLoading || results.some(result => result.isLoading),
      isError: farmsQuery.isError || results.some(result => result.isError),
    }),
  })
}
