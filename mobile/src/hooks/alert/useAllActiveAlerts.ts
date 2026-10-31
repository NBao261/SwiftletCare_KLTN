import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import { MAX_PAGE_LIMIT, fetchAllPages } from '@/utils/pagination.utils'

// Mọi cảnh báo đang mở của mọi Farm, tải đủ các trang theo meta.total
export function useAllActiveAlerts() {
  return useQuery({
    queryKey: ['alerts', 'all-active'],
    queryFn: () =>
      fetchAllPages(page =>
        alertApi
          .list({ status: 'ACTIVE', limit: String(MAX_PAGE_LIMIT), page: String(page) })
          .then(response => ({ items: response.data.data, total: response.data.meta?.total ?? 0 })),
      ),
  })
}
