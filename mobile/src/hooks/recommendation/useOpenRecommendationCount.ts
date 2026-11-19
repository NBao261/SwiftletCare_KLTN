import { useQueries } from '@tanstack/react-query'
import { useFarms } from '@/hooks/farm/useFarms'
import { recommendationApi } from '@/services/api/recommendation.api'

// Số khuyến nghị đang chờ quyết định ở mọi farm cho khối ở Trang chủ: mỗi farm tải 1 dòng, chỉ đọc meta.total
export function useOpenRecommendationCount(enabled = true) {
  const farmsQuery = useFarms()
  const farmIds = enabled ? (farmsQuery.data?.data ?? []).map(farm => farm._id) : []

  return useQueries({
    queries: farmIds.map(farmId => ({
      queryKey: ['recommendations', 'open-count', farmId],
      queryFn: () =>
        recommendationApi.list({ farmId, status: 'OPEN', limit: 1 }).then(response => response.data.meta?.total ?? 0),
    })),
    combine: results => ({
      count: results.reduce((total, result) => total + (result.data ?? 0), 0),
      isLoading: farmsQuery.isLoading || results.some(result => result.isLoading),
      isError: farmsQuery.isError || results.some(result => result.isError),
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  })
}
