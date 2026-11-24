import { useQuery } from '@tanstack/react-query'
import { expertActivityApi } from '@/services/api/expertActivity.api'

// Số mục của Farm Owner còn chờ chuyên gia: thay đổi PENDING_REVIEW + gợi ý PROPOSED — chỉ cần meta.total nên mỗi loại
// tải 1 dòng
export function usePendingExpertReviewCount(farmId: string) {
  return useQuery({
    queryKey: ['expert-activity', 'pending-count', farmId],
    queryFn: async () => {
      const [reviews, proposals] = await Promise.all([
        expertActivityApi.listReviews({ farmId, status: 'PENDING_REVIEW', limit: 1 }),
        expertActivityApi.listProposals({ farmId, status: 'PROPOSED', limit: 1 }),
      ])
      return (reviews.data.meta?.total ?? 0) + (proposals.data.meta?.total ?? 0)
    },
    enabled: Boolean(farmId),
  })
}
