import { useMutation, useQueryClient } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'
import { readApiError } from '@/utils/apiError.utils'

// Chủ trại duyệt phiếu chờ duyệt (OPS-FR-004): đóng phiếu và cảnh báo gắn kèm.
// Xong, hoặc phiếu vừa đổi trạng thái (409), thì tải lại danh sách, chi tiết và cảnh báo
export function useApproveWorkOrder() {
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    ])

  return useMutation({
    mutationFn: (workOrderId: string) =>
      workOrderApi.approve(workOrderId).then(response => response.data.data),
    onSuccess: refresh,
    onError: error => {
      if (readApiError(error).status === 409) void refresh()
    },
  })
}
