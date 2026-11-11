import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { Alert } from '@/types'
import { uniqueById } from '@/utils/alertList.utils'
import { fetchAllPages, MAX_PAGE_LIMIT } from '@/utils/pagination.utils'

// Không có sự kiện socket khi cảnh báo đổi trạng thái nên tải lại định kỳ — chỉ khi tab Cảnh báo đang hiện, vì mỗi lần
// tải lại là đủ mọi trang (Known debt: backend chưa lọc nhà gồm cả tầng, chưa nhận nhiều trạng thái một lần)
const REFRESH_INTERVAL_MS = 30 * 1000

// Chỉ dùng khi tab Cảnh báo đang lọc MỘT nhà: backend ?houseId chỉ trả cảnh báo mức nhà, không gồm các tầng, nên tải đủ
// cảnh báo đang hiệu lực (ACTIVE + ACKNOWLEDGED, ALERT-FR-007) của farm rồi lọc nhà, tầng, mức, loại, phán quyết trên máy
// (Known debt). Không lọc nhà thì màn dùng usePagedAlertList (phân trang ở server)
export function useActiveAlertList(farmId: string | null, enabled: boolean, isFocused: boolean) {
  return useQuery({
    queryKey: ['alerts', 'list', 'active', farmId ?? 'all'],
    queryFn: async (): Promise<Alert[]> => {
      const fetchStatus = (status: 'ACTIVE' | 'ACKNOWLEDGED') =>
        fetchAllPages(page =>
          alertApi
            .list({ ...(farmId ? { farmId } : {}), status, page: String(page), limit: String(MAX_PAGE_LIMIT) })
            .then(response => ({ items: response.data.data, total: response.data.meta?.total ?? 0 })),
        )
      const [active, acknowledged] = await Promise.all([fetchStatus('ACTIVE'), fetchStatus('ACKNOWLEDGED')])
      return uniqueById([...active, ...acknowledged])
    },
    enabled,
    refetchInterval: isFocused ? REFRESH_INTERVAL_MS : false,
  })
}
