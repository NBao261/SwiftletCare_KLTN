import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { recommendationRulesApi } from '@/apis/domain-expert/recommendationRules.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { RecommendationRuleInput } from '@/types'

// Khoá gốc chung: ghi luật làm mới cả danh sách lẫn hiệu quả
const RULES_KEY = 'recommendation-rules'
export const RULES_PAGE_SIZE = 10

// EXPERT-FR-016 — luật của farm, mới sửa trước, phân trang server
export function useRecommendationRules(farmId: string | undefined, page: number) {
  return usePaginatedListQuery(
    [RULES_KEY, 'list', farmId, page],
    () => recommendationRulesApi.list(farmId!, page, RULES_PAGE_SIZE),
    page,
    RULES_PAGE_SIZE,
    { enabled: Boolean(farmId) },
  )
}

// EXPERT-FR-019 — số khuyến nghị đã mở, chấp nhận, đo, cải thiện theo từng luật
export function useRecommendationRuleEffects(farmId: string | undefined) {
  return useQuery({
    queryKey: [RULES_KEY, 'effects', farmId],
    queryFn: () => recommendationRulesApi.effects(farmId!).then(response => response.data.data ?? []),
    enabled: Boolean(farmId),
  })
}

// Tạo mới (không có id) hoặc sửa, bật/tắt (có id)
export function useSaveRecommendationRule(farmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: RecommendationRuleInput }) =>
      id ? recommendationRulesApi.update(id, input) : recommendationRulesApi.create(farmId!, input),
    // Cả khi lỗi (409: chuyên gia vừa quyết định luật) để danh sách theo bản mới
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: [RULES_KEY] }) },
  })
}
