import { useMutation, useQueryClient } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'
import { readApiError } from '@/utils/apiError.utils'

// Chủ trại mở lại phiếu chờ duyệt kèm ghi chú (OPS-FR-004): về Đang làm.
// Xong, hoặc phiếu vừa đổi trạng thái (409), thì tải lại danh sách, chi tiết và cảnh báo
export function useReopenWorkOrder() {
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    ])

  return useMutation({
    mutationFn: ({ workOrderId, note }: { workOrderId: string; note: string }) =>
      workOrderApi.reopen(workOrderId, note).then(response => response.data.data),
    onSuccess: refresh,
    onError: error => {
      if (readApiError(error).status === 409) void refresh()
    },
  })
}
