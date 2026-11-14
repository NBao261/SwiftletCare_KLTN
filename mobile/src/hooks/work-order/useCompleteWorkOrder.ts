import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateAlertQueries } from '@/config/queryClient'
import { workOrderApi } from '@/services/api/workOrder.api'
import type { CompleteWorkOrderInput } from '@/types'
import { readApiError } from '@/utils/apiError.utils'

// Báo đã làm xong một Work Order kèm nguyên nhân, việc đã làm, ảnh (OPS-FR-002, ALERT-FR-018): xong thì tải lại Work Order và
// cảnh báo (nguyên nhân và ảnh cũng lưu vào cảnh báo). Work Order vừa đổi trạng thái (409) thì tải lại Work Order
export function useCompleteWorkOrder(workOrderId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CompleteWorkOrderInput) => workOrderApi.complete(workOrderId, input),
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: ['work-orders'] }), invalidateAlertQueries(queryClient)]),
    onError: error => {
      if (readApiError(error).status === 409) void queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })
}
