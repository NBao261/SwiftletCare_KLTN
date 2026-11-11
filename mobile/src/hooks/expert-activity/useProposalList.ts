import { useInfiniteQuery } from '@tanstack/react-query'
import { expertActivityApi } from '@/services/api/expertActivity.api'

const PAGE_SIZE = 20

// Gợi ý hệ số Farm Owner đã gửi chuyên gia (EXPERT-FR-011), mới nhất trước, tải thêm theo meta
export function useProposalList(farmId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['expert-activity', 'proposals', farmId],
    queryFn: ({ pageParam }) =>
      expertActivityApi.listProposals({ farmId, page: pageParam, limit: PAGE_SIZE }).then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
    enabled: enabled && Boolean(farmId),
  })
}
