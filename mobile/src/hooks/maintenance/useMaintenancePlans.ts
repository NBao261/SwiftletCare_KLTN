import { useInfiniteQuery } from '@tanstack/react-query'
import { maintenanceApi } from '@/services/api/maintenance.api'

const PAGE_SIZE = 20

// Mọi kế hoạch bảo trì còn dùng của các nhà người dùng được xem, tải thêm theo meta.total (OPS-FR-005)
export function useMaintenancePlans(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['maintenance', 'plans'],
    queryFn: ({ pageParam }) =>
      maintenanceApi.listPlans({ page: pageParam, limit: PAGE_SIZE }).then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
    enabled,
  })
}
