import { useMutation, useQueryClient } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'
import { readApiError } from '@/utils/apiError.utils'

// Bắt đầu làm một Work Order (OPS-FR-002): OPEN → IN_PROGRESS; xong thì tải lại danh sách, chi tiết, số đếm. Work Order vừa đổi
// trạng thái (409) thì cũng tải lại để màn thấy trạng thái mới
export function useStartWorkOrder() {
  const queryClient = useQueryClient()
  const refreshWorkOrders = () => queryClient.invalidateQueries({ queryKey: ['work-orders'] })

  return useMutation({
    mutationFn: (workOrderId: string) => workOrderApi.start(workOrderId),
    onSuccess: refreshWorkOrders,
    onError: error => {
      if (readApiError(error).status === 409) void refreshWorkOrders()
    },
  })
}
