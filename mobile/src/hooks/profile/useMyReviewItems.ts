import { useQuery } from '@tanstack/react-query'
import { IS_MOCK_API_ENABLED } from '@/constants/mockApi'
import { expertActivityApi } from '@/services/api/expertActivity.api'

// Thay đổi ngưỡng, hệ số và gợi ý của Farm Owner chờ chuyên gia (EXPERT-FR-010/011) — đang là dữ liệu mẫu
export function useMyReviewItems(farmId: string) {
  return useQuery({
    queryKey: ['expert-activity', 'review-items', farmId],
    queryFn: () => expertActivityApi.listMyReviewItems(farmId).then(response => response.data.data),
    enabled: IS_MOCK_API_ENABLED && Boolean(farmId),
  })
}
