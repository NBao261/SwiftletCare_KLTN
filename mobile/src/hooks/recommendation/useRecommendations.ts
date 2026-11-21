import { useInfiniteQuery } from '@tanstack/react-query'
import { recommendationApi } from '@/services/api/recommendation.api'
import type { RecommendationStatus } from '@/types'

const PAGE_SIZE = 20

// Khuyến nghị của một farm theo một trạng thái (GET /recommendations nhận một farmId và một status), mới mở trước, tải thêm
// theo meta.total như các danh sách khác — không tải hết rồi lọc trên máy
export function useRecommendations(farmId: string, status: RecommendationStatus, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['recommendations', 'list', farmId, status],
    queryFn: ({ pageParam }) =>
      recommendationApi.list({ farmId, status, page: pageParam, limit: PAGE_SIZE }).then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
    enabled: enabled && Boolean(farmId),
  })
}
