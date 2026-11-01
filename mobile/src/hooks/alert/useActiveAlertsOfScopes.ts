import { useQueries } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { Alert } from '@/types'
import { MAX_PAGE_LIMIT } from '@/utils/pagination.utils'

// Cảnh báo zone không mang house_id, nên số cảnh báo của một nhà = cảnh báo mức nhà + cảnh báo từng zone
export type AlertScope = { houseId: string } | { zoneId: string }

export interface ScopeAlerts {
  // meta.total của backend — không đếm trên máy
  total: number
  // Trang đầu, mới nhất trước: đủ để biết mức cao nhất, dự báo và cảnh báo chặn bật bơm
  alerts: Alert[]
}

// Không có cảnh báo nào hết hiệu lực qua socket nên tải lại định kỳ
const REFRESH_INTERVAL_MS = 30 * 1000

// Khoá của một phạm vi trong kết quả: "house:<id>", "zone:<id>"
export function getScopeKey(scope: AlertScope): string {
  return 'houseId' in scope ? `house:${scope.houseId}` : `zone:${scope.zoneId}`
}

// Cảnh báo đang hiệu lực (ACTIVE) của nhiều nhà/zone, mỗi phạm vi một request
export function useActiveAlertsOfScopes(scopes: AlertScope[]) {
  return useQueries({
    queries: scopes.map(scope => ({
      queryKey: ['alerts', 'active-of-scope', scope],
      queryFn: () =>
        alertApi
          .list({ ...scope, status: 'ACTIVE', limit: String(MAX_PAGE_LIMIT) })
          .then((response): ScopeAlerts => ({ total: response.data.meta?.total ?? 0, alerts: response.data.data })),
      refetchInterval: REFRESH_INTERVAL_MS,
    })),
    combine: results => ({
      byScopeKey: new Map(
        results.flatMap((result, index) => (result.data ? [[getScopeKey(scopes[index]), result.data] as const] : [])),
      ),
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
    }),
  })
}
