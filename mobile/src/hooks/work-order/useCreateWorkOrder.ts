import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type CreateWorkOrderInput, workOrderApi } from '@/services/api/workOrder.api'

// Chủ trại mở phiếu công việc bằng tay (OPS-FR-001); xong thì tải lại danh sách, số đếm và phiếu của cảnh báo
export function useCreateWorkOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateWorkOrderInput) => workOrderApi.create(input).then(response => response.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
  })
}
