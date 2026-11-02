import { useQueries } from '@tanstack/react-query'
import { useFarms } from '@/hooks/farm/useFarms'
import { alertApi } from '@/services/api/alert.api'

// Số cảnh báo suy luận chờ chủ trại phán quyết — chỉ ở farm chưa có chuyên gia (BR-22); có chuyên gia thì chuyên gia quyết.
// Chỉ cần meta.total nên mỗi farm tải 1 dòng
export function usePendingVerdictAlertCount() {
  const farmsQuery = useFarms()
  const farmIdsWithoutExpert = (farmsQuery.data?.data ?? [])
    .filter(farm => !farm.members.some(member => member.role === 'DOMAIN_EXPERT'))
    .map(farm => farm._id)

  return useQueries({
    queries: farmIdsWithoutExpert.map(farmId => ({
      queryKey: ['alerts', 'pending-verdict-count', farmId],
      queryFn: () =>
        alertApi
          .list({ farmId, verdict: 'pending', status: 'ACTIVE', limit: '1' })
          .then(response => response.data.meta?.total ?? 0),
    })),
    combine: results => ({
      count: results.reduce((total, result) => total + (result.data ?? 0), 0),
      isLoading: farmsQuery.isLoading || results.some(result => result.isLoading),
      isError: farmsQuery.isError || results.some(result => result.isError),
    }),
  })
}
