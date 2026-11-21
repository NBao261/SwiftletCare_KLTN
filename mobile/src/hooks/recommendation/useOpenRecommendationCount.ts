import { useQueries } from '@tanstack/react-query'
import { useFarms } from '@/hooks/farm/useFarms'
import { recommendationApi } from '@/services/api/recommendation.api'

// Số khuyến nghị đang chờ quyết định ở mọi farm cho khối ở Trang chủ: mỗi farm tải 1 dòng, chỉ đọc meta.total.
// firstOpenFarmId là farm đầu tiên còn khuyến nghị mở, để màn danh sách (xem theo một farm) mở đúng farm đó
export function useOpenRecommendationCount(enabled = true) {
  const farmsQuery = useFarms()
  const farmIds = enabled ? (farmsQuery.data?.data ?? []).map(farm => farm._id) : []

  return useQueries({
    queries: farmIds.map(farmId => ({
      queryKey: ['recommendations', 'open-count', farmId],
      queryFn: () =>
        recommendationApi.list({ farmId, status: 'OPEN', limit: 1 }).then(response => response.data.meta?.total ?? 0),
    })),
    combine: results => {
      const firstOpenIndex = results.findIndex(result => (result.data ?? 0) > 0)
      return {
        count: results.reduce((total, result) => total + (result.data ?? 0), 0),
        firstOpenFarmId: firstOpenIndex >= 0 ? farmIds[firstOpenIndex] : undefined,
        isLoading: farmsQuery.isLoading || results.some(result => result.isLoading),
        isError: farmsQuery.isError || results.some(result => result.isError),
        // Danh sách farm lỗi thì chưa có query đếm nào, nên thử lại chính danh sách farm
        refetch: () =>
          farmsQuery.isError ? farmsQuery.refetch() : Promise.all(results.map(result => result.refetch())),
      }
    },
  })
}
