import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recommendationApi } from '@/services/api/recommendation.api'

// Chủ trại chấp nhận khuyến nghị (EXPERT-FR-018): backend mở phiếu công việc hoặc đổi tham số mọi zone của nhà, nên tải lại phiếu
// và zone. Dù lỗi cũng tải lại khuyến nghị vì nó có thể vừa hết hạn hoặc vừa được quyết định ở máy khác (409)
export function useAcceptRecommendation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (recommendationId: string) =>
      recommendationApi.accept(recommendationId).then(response => response.data.data),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['zones'] }),
      ]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  })
}
