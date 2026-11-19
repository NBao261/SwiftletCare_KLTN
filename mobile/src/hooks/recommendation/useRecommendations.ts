import { useQueries } from '@tanstack/react-query'
import { useFarms } from '@/hooks/farm/useFarms'
import { recommendationApi } from '@/services/api/recommendation.api'
import type { RecommendationStatus } from '@/types'

// Mỗi luật mỗi nhà chỉ một khuyến nghị đang mở (BR-42) nên mỗi farm ít khuyến nghị; tải một trang lớn thay cho phân trang
const PAGE_LIMIT = 100

// Khuyến nghị của mọi farm người dùng được xem theo một trạng thái (không truyền là mọi trạng thái), mới nhất trước
export function useRecommendations(status: RecommendationStatus | undefined, enabled = true) {
  const farmsQuery = useFarms()
  const farmIds = (farmsQuery.data?.data ?? []).map(farm => farm._id)

  return useQueries({
    queries: farmIds.map(farmId => ({
      queryKey: ['recommendations', farmId, status ?? 'all'],
      queryFn: () => recommendationApi.list({ farmId, status, limit: PAGE_LIMIT }).then(response => response.data.data),
      enabled,
    })),
    combine: results => ({
      recommendations: results
        .flatMap(result => result.data ?? [])
        .sort((left, right) => right.raised_at.localeCompare(left.raised_at)),
      isLoading: farmsQuery.isLoading || results.some(result => result.isLoading),
      isError: farmsQuery.isError || results.some(result => result.isError),
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  })
}
