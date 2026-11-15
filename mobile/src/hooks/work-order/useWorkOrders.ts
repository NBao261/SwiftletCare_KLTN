import { useInfiniteQuery } from '@tanstack/react-query'
import { workOrderApi, type WorkOrderListParams } from '@/services/api/workOrder.api'

const PAGE_SIZE = 20

// Danh sách Work Order theo bộ lọc, mới mở trước, tải thêm theo meta.total (OPS-FR-001…004)
export function useWorkOrders(filters: Omit<WorkOrderListParams, 'page' | 'limit'>, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['work-orders', 'list', filters],
    queryFn: ({ pageParam }) =>
      workOrderApi.list({ ...filters, page: pageParam, limit: PAGE_SIZE }).then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
    enabled,
  })
}
