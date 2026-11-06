import { useQuery } from '@tanstack/react-query'
import { IS_MOCK_API_ENABLED } from '@/constants/mockApi'
import { expertActivityApi } from '@/services/api/expertActivity.api'

// Quyết định của chuyên gia trên farm (EXPERT-FR-009) — đang là dữ liệu mẫu, tắt mẫu thì không tải
export function useExpertDecisions(farmId: string) {
  return useQuery({
    queryKey: ['expert-activity', 'decisions', farmId],
    queryFn: () => expertActivityApi.listDecisions(farmId).then(response => response.data.data),
    enabled: IS_MOCK_API_ENABLED && Boolean(farmId),
  })
}
