import { useMutation, useQueryClient } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'

// Bắt đầu làm một Work Order (OPS-FR-002): OPEN → IN_PROGRESS; xong thì tải lại danh sách, chi tiết, số đếm
export function useStartWorkOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workOrderId: string) => workOrderApi.start(workOrderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
  })
}
