import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recommendationApi } from '@/services/api/recommendation.api'

export interface RejectRecommendationInput {
  recommendationId: string
  reason: string
}

// Chủ trại từ chối khuyến nghị kèm lý do (EXPERT-FR-018); dù lỗi cũng tải lại vì khuyến nghị có thể vừa hết hạn (409)
export function useRejectRecommendation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ recommendationId, reason }: RejectRecommendationInput) =>
      recommendationApi.reject(recommendationId, reason).then(response => response.data.data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  })
}
