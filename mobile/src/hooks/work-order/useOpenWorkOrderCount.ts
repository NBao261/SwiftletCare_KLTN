import { useQuery } from '@tanstack/react-query'
import { workOrderApi } from '@/services/api/workOrder.api'

// Số Work Order còn mở cho khối "Work Order" ở Trang chủ: kỹ thuật viên đếm việc giao cho mình, chủ trại đếm cả farm — chỉ đọc
// meta.total của một trang 1 dòng
export function useOpenWorkOrderCount(onlyMine: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['work-orders', 'open-count', onlyMine],
    queryFn: () =>
      workOrderApi
        .list({ open: 'true', assigneeId: onlyMine ? 'me' : undefined, limit: 1 })
        .then(response => response.data.meta?.total ?? response.data.data.length),
    enabled,
  })
}
