// EXPERT-FR-016…019 — React Query hooks cho luật khuyến nghị
// Backend chưa sẵn; hook fallback về mock data khi API trả lỗi.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recommendationRulesApi } from '@/apis/domain-expert/recommendationRules.api'
import { MOCK_RECOMMENDATION_RULES, MOCK_RECOMMENDATION_EFFECTS } from '@/data/recommendationRules.data'
import type { RecommendationRule } from '@/types/expert.types'

const RULES_KEY = (farmId: string) => ['recommendation-rules', farmId]
const EFFECTS_KEY = (farmId: string) => ['recommendation-effects', farmId]

export function useRecommendationRules(farmId: string | undefined | null) {
  return useQuery({
    queryKey: RULES_KEY(farmId ?? ''),
    queryFn: async () => {
      try {
        const r = await recommendationRulesApi.listRules(farmId!)
        return r.data.data ?? []
      } catch {
        return MOCK_RECOMMENDATION_RULES
      }
    },
    enabled: !!farmId,
    staleTime: 30_000,
  })
}

export function useRecommendationEffects(farmId: string | undefined | null) {
  return useQuery({
    queryKey: EFFECTS_KEY(farmId ?? ''),
    queryFn: async () => {
      try {
        const r = await recommendationRulesApi.listEffects(farmId!)
        return r.data.data ?? []
      } catch {
        return MOCK_RECOMMENDATION_EFFECTS
      }
    },
    enabled: !!farmId,
    staleTime: 60_000,
  })
}

export function useCreateRecommendationRule(farmId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rule: Omit<RecommendationRule, '_id'>) =>
      recommendationRulesApi.createRule(farmId!, rule),
    onSuccess: () => { qc.invalidateQueries({ queryKey: RULES_KEY(farmId ?? '') }) },
  })
}

export function useUpdateRecommendationRule(farmId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: Omit<RecommendationRule, '_id'> }) =>
      recommendationRulesApi.updateRule(id, rule),
    onSuccess: () => { qc.invalidateQueries({ queryKey: RULES_KEY(farmId ?? '') }) },
  })
}

export function useDeleteRecommendationRule(farmId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => recommendationRulesApi.deleteRule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: RULES_KEY(farmId ?? '') }) },
  })
}
