import { useQuery } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'

// Một Work Order theo id, kèm ảnh (URL tạm 1 giờ) và lịch sử trạng thái. Trạng thái đổi cả phía server (job kiểm phục hồi chạy
// mỗi phút) nên mỗi lần mở màn đều tải bản mới — mở từ thông báo đẩy khi app ở nền thì socket chưa kịp nối lại để báo
export function useWorkOrderDetail(workOrderId: string) {
  return useQuery({
    queryKey: ['work-orders', 'detail', workOrderId],
    queryFn: () => workOrderApi.getDetail(workOrderId).then(response => response.data.data),
    enabled: Boolean(workOrderId),
    staleTime: 0,
  })
}
