import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { Alert } from '@/types'
import { fetchAllPages, MAX_PAGE_LIMIT } from '@/utils/pagination.utils'

// Không có sự kiện socket khi cảnh báo đổi trạng thái nên tải lại định kỳ
const REFRESH_INTERVAL_MS = 30 * 1000

// Cảnh báo đang hiệu lực của một farm (ACTIVE + ACKNOWLEDGED, ALERT-FR-007), đủ mọi trang. Lọc nhà, tầng, mức, loại,
// phán quyết làm trong app: ?houseId của backend chỉ trả cảnh báo mức nhà, không gồm cảnh báo các tầng
export function useActiveAlertList(farmId: string) {
  return useQuery({
    queryKey: ['alerts', 'list', 'active', farmId],
    queryFn: async (): Promise<Alert[]> => {
      const fetchStatus = (status: 'ACTIVE' | 'ACKNOWLEDGED') =>
        fetchAllPages(page =>
          alertApi
            .list({ farmId, status, page: String(page), limit: String(MAX_PAGE_LIMIT) })
            .then(response => ({ items: response.data.data, total: response.data.meta?.total ?? 0 })),
        )
      const [active, acknowledged] = await Promise.all([fetchStatus('ACTIVE'), fetchStatus('ACKNOWLEDGED')])
      return [...active, ...acknowledged]
    },
    enabled: Boolean(farmId),
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}
