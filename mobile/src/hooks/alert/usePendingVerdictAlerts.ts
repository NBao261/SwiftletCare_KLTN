import { useQueries } from '@tanstack/react-query'
import { useFarms } from '@/hooks/farm/useFarms'
import { alertApi } from '@/services/api/alert.api'
import type { Alert } from '@/types'
import { sortAlerts } from '@/utils/alertList.utils'
import { farmHasExpert } from '@/utils/farm.utils'

// Một lần tải tối đa ngần này cảnh báo chờ phán quyết mỗi farm; còn nữa thì xem ở tab Cảnh báo
const PENDING_VERDICT_PAGE_SIZE = 50

// Cảnh báo suy luận đang mở chờ chủ trại phán quyết ở các farm chưa có chuyên gia (BR-22), cùng phạm vi với số ở khối
// "Đánh giá ngày"; xếp như tab Cảnh báo (mức nặng trước, rồi mới nhất trước). enabled = false thì không gọi
export function usePendingVerdictAlerts(enabled = true) {
  const farmsQuery = useFarms()
  const farmIdsWithoutExpert = enabled
    ? (farmsQuery.data?.data ?? []).filter(farm => !farmHasExpert(farm)).map(farm => farm._id)
    : []

  return useQueries({
    queries: farmIdsWithoutExpert.map(farmId => ({
      queryKey: ['alerts', 'pending-verdict', farmId],
      queryFn: () =>
        alertApi
          .list({
            farmId,
            verdict: 'pending',
            status: 'ACTIVE',
            limit: String(PENDING_VERDICT_PAGE_SIZE),
          })
          .then(response => ({
            alerts: response.data.data,
            total: response.data.meta?.total ?? response.data.data.length,
          })),
    })),
    combine: (
      results,
    ): {
      alerts: Alert[]
      total: number
      isLoading: boolean
      isError: boolean
    } => ({
      alerts: sortAlerts(results.flatMap(result => result.data?.alerts ?? [])),
      total: results.reduce((sum, result) => sum + (result.data?.total ?? 0), 0),
      isLoading: farmsQuery.isLoading || results.some(result => result.isLoading),
      isError: farmsQuery.isError || results.some(result => result.isError),
    }),
  })
}
