import { useQueries } from '@tanstack/react-query'
import { useFarms } from '@/hooks/farm/useFarms'
import { alertApi } from '@/services/api/alert.api'

// Cảnh báo suy luận chờ chủ trại phán quyết — chỉ ở farm chưa có chuyên gia (BR-22); có chuyên gia thì chuyên gia quyết
export function usePendingVerdictAlerts() {
  const farmsQuery = useFarms()
  const farmIdsWithoutExpert = (farmsQuery.data?.data ?? [])
    .filter(farm => !farm.members.some(member => member.role === 'DOMAIN_EXPERT'))
    .map(farm => farm._id)

  return useQueries({
    queries: farmIdsWithoutExpert.map(farmId => ({
      queryKey: ['alerts', 'pending-verdict', farmId],
      queryFn: () =>
        alertApi.list({ farmId, verdict: 'pending', status: 'ACTIVE' }).then(response => response.data.data),
    })),
    combine: results => ({
      alerts: results.flatMap(result => result.data ?? []),
    }),
  })
}
