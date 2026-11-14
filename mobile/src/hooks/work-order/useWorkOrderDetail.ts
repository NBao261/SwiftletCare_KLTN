import { useQuery } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'

// Một Work Order theo id, kèm ảnh (URL tạm 1 giờ) và lịch sử trạng thái
export function useWorkOrderDetail(workOrderId: string) {
  return useQuery({
    queryKey: ['work-orders', 'detail', workOrderId],
    queryFn: () => workOrderApi.getDetail(workOrderId).then(response => response.data.data),
    enabled: Boolean(workOrderId),
  })
}
