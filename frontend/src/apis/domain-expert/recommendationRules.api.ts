// EXPERT-FR-016…019, BR-42 — Luật khuyến nghị
// Backend chưa sẵn (G-24 tuần 4); hook sẽ fallback về mock data khi nhận lỗi 404/500.
import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type { RecommendationRule, RecommendationEffect } from '@/types/expert.types'

export const recommendationRulesApi = {
  listRules: (farmId: string) =>
    api.get<ApiResponse<RecommendationRule[]>>('/recommendation-rules', { params: { farmId } }),

  createRule: (farmId: string, rule: Omit<RecommendationRule, '_id'>) =>
    api.post<ApiResponse<RecommendationRule>>('/recommendation-rules', { farm_id: farmId, ...rule }),

  updateRule: (id: string, rule: Omit<RecommendationRule, '_id'>) =>
    api.put<ApiResponse<RecommendationRule>>(`/recommendation-rules/${id}`, rule),

  deleteRule: (id: string) =>
    api.delete<ApiResponse<void>>(`/recommendation-rules/${id}`),

  listEffects: (farmId: string) =>
    api.get<ApiResponse<RecommendationEffect[]>>('/recommendation-rules/effects', { params: { farmId } }),
}
