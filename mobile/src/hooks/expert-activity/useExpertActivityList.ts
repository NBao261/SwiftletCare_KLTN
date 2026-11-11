import { useInfiniteQuery } from '@tanstack/react-query'
import { expertActivityApi } from '@/services/api/expertActivity.api'

const PAGE_SIZE = 20

// Lịch sử quyết định của chuyên gia trên farm (EXPERT-FR-009), mới nhất trước, tải thêm theo meta
export function useExpertActivityList(farmId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['expert-activity', 'decisions', farmId],
    queryFn: ({ pageParam }) =>
      expertActivityApi.listActivity({ farmId, page: pageParam, limit: PAGE_SIZE }).then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
    enabled: enabled && Boolean(farmId),
  })
}
