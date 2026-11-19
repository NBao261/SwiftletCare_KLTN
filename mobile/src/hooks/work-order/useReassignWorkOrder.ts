import { useMutation, useQueryClient } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'
import { readApiError } from '@/utils/apiError.utils'

// Chủ trại giao lại phiếu cho kỹ thuật viên khác của nhà (OPS-FR-004).
// Xong, hoặc phiếu vừa đổi trạng thái (409), thì tải lại danh sách, chi tiết và cảnh báo
export function useReassignWorkOrder() {
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    ])

  return useMutation({
    mutationFn: ({ workOrderId, assigneeId }: { workOrderId: string; assigneeId: string }) =>
      workOrderApi.reassign(workOrderId, assigneeId).then(response => response.data.data),
    onSuccess: refresh,
    onError: error => {
      if (readApiError(error).status === 409) void refresh()
    },
  })
}
