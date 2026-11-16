import { useMutation, useQueryClient } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'
import type { ChecklistItemInput } from '@/types'
import { readApiError } from '@/utils/apiError.utils'

// Ghi một mục checklist của Work Order phòng ngừa (OPS-FR-007): xong thì tải lại Work Order (mục DEFECT mở thêm một Work Order
// sửa chữa) và kế hoạch bảo trì. Work Order vừa đổi trạng thái (409) thì tải lại Work Order
export function useRecordChecklistItem(workOrderId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ChecklistItemInput) => workOrderApi.recordChecklistItem(workOrderId, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
      ]),
    onError: error => {
      if (readApiError(error).status === 409) void queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })
}
