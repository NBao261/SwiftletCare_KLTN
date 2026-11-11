import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { Alert } from '@/types'
import { uniqueById } from '@/utils/alertList.utils'
import { fetchAllPages, MAX_PAGE_LIMIT } from '@/utils/pagination.utils'

// Chỉ dùng khi tab Cảnh báo đang lọc MỘT nhà (xem useActiveAlertList): cảnh báo đã đóng của farm — đã hết (RESOLVED) và bị
// bác bỏ (DISMISSED, đổi lại "Đúng" thì về Đang hiệu lực) — tải đủ rồi lọc trên máy. Không lọc nhà thì phân trang ở server
export function useResolvedAlertList(farmId: string | null, enabled: boolean) {
  return useQuery({
    // Khoá khác bản tải theo trang cũ ('resolved', dữ liệu { pages }) để cache cũ còn trong máy không bị đọc nhầm
    queryKey: ['alerts', 'list', 'closed', farmId ?? 'all'],
    queryFn: async (): Promise<Alert[]> => {
      const fetchStatus = (status: 'RESOLVED' | 'DISMISSED') =>
        fetchAllPages(page =>
          alertApi
            .list({ ...(farmId ? { farmId } : {}), status, page: String(page), limit: String(MAX_PAGE_LIMIT) })
            .then(response => ({ items: response.data.data, total: response.data.meta?.total ?? 0 })),
        )
      const [resolved, dismissed] = await Promise.all([fetchStatus('RESOLVED'), fetchStatus('DISMISSED')])
      // Mới nhất trước, như backend trả từng trạng thái
      return uniqueById([...resolved, ...dismissed]).sort((first, second) =>
        second.created_at.localeCompare(first.created_at),
      )
    },
    enabled,
  })
}
