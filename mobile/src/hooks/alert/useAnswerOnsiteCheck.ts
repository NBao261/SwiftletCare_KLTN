import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateAlertQueries } from '@/config/queryClient'
import { alertApi } from '@/services/api/alert.api'
import type { OnsiteCheckAnswerInput } from '@/types'

// Thợ của nhà trả lời yêu cầu kiểm tra tại chỗ (EXPERT-FR-021): xong thì tải lại cảnh báo (câu trả lời vào bằng chứng) và Work
// Order — SENSOR_ANOMALY trả lời "cảm biến bẩn hoặc hỏng" thì backend mở ngay một Work Order sửa chữa
export function useAnswerOnsiteCheck(alertId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: OnsiteCheckAnswerInput) => alertApi.answerOnsiteCheck(alertId, input),
    onSuccess: () =>
      Promise.all([
        invalidateAlertQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
      ]),
  })
}
