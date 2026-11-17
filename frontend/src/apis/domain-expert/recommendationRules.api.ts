import api from '@/lib/axios'
import type { ApiResponse, RecommendationRule, RecommendationRuleEffect, RecommendationRuleInput } from '@/types'

// EXPERT-FR-016, 019 — luật khuyến nghị của farm: chuyên gia viết, sửa, bật/tắt; hiệu quả theo luật
export const recommendationRulesApi = {
  list: (farmId: string, page: number, limit: number) =>
    api.get<ApiResponse<RecommendationRule[]>>('/recommendations/rules', { params: { farmId, page, limit } }),

  create: (farmId: string, input: RecommendationRuleInput) =>
    api.post<ApiResponse<RecommendationRule>>('/recommendations/rules', { farm_id: farmId, ...input }),

  // Thay toàn bộ nội dung luật; bật/tắt cũng gửi cả luật với `active` mới
  update: (id: string, input: RecommendationRuleInput) =>
    api.put<ApiResponse<RecommendationRule>>(`/recommendations/rules/${id}`, input),

  effects: (farmId: string) =>
    api.get<ApiResponse<RecommendationRuleEffect[]>>('/recommendations/rules/effects', { params: { farmId } }),
}
