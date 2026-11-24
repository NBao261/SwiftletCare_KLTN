import api from '@/lib/axios';
import type { ApiResponse, Recommendation, RecommendationStatus } from '@/types';

export interface RecommendationListQuery {
  farmId?: string;
  houseId?: string;
  status?: RecommendationStatus;
  page: number;
  limit: number;
}

// khuyến nghị của nhà hoặc farm; Farm Owner chấp nhận hoặc từ chối kèm lý do
export const recommendationsApi = {
  list: (query: RecommendationListQuery) =>
    api.get<ApiResponse<Recommendation[]>>('/recommendations', { params: query }),

  accept: (id: string) =>
    api.post<ApiResponse<Recommendation>>(`/recommendations/${id}/accept`),

  reject: (id: string, reason: string) =>
    api.post<ApiResponse<Recommendation>>(`/recommendations/${id}/reject`, { reason }),
};
