import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateAlertQueries } from '@/config/queryClient'
import { alertApi } from '@/services/api/alert.api'
import type { OnsiteCheckAnswerInput } from '@/types'
import { readApiError } from '@/utils/apiError.utils'

// Thợ của nhà trả lời yêu cầu kiểm tra tại chỗ (EXPERT-FR-021): xong thì tải lại cảnh báo (câu trả lời vào bằng chứng) và Work
// Order — SENSOR_ANOMALY trả lời "cảm biến bẩn hoặc hỏng" thì backend mở ngay một Work Order sửa chữa. Yêu cầu đã được trả lời
// hoặc không còn (409) thì tải lại cảnh báo
export function useAnswerOnsiteCheck(alertId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: OnsiteCheckAnswerInput) => alertApi.answerOnsiteCheck(alertId, input),
    onSuccess: () =>
      Promise.all([
        invalidateAlertQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
      ]),
    onError: error => {
      if (readApiError(error).status === 409) void invalidateAlertQueries(queryClient)
    },
  })
}
