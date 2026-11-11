import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { Alert, AlertSeverity } from '@/types'
import { ALERT_SEVERITIES, type ServerAlertFilter, sumLevelCounts, toAlertQueryParams } from '@/utils/alertList.utils'

interface AlertLevelCountsInput {
  statuses: readonly Alert['status'][]
  filter: ServerAlertFilter
  enabled: boolean
  refetchInterval: number | false
}

// Số cảnh báo theo cấp (dải tóm tắt tab Cảnh báo) từ meta.total của server với cùng bộ lọc farm, loại, phán quyết — không
// đếm phần đã tải. Mỗi trạng thái × mức một request 1 dòng
export function useAlertLevelCounts({ statuses, filter, enabled, refetchInterval }: AlertLevelCountsInput) {
  return useQuery({
    queryKey: ['alerts', 'counts', statuses.join(','), filter],
    queryFn: async () => {
      const totals = await Promise.all(
        ALERT_SEVERITIES.map(async severity => {
          const perStatus = await Promise.all(
            statuses.map(status =>
              alertApi
                .list(toAlertQueryParams(filter, { status, severity }, 1, 1))
                .then(response => response.data.meta?.total ?? 0),
            ),
          )
          return [severity, perStatus.reduce((sum, value) => sum + value, 0)] as const
        }),
      )
      return sumLevelCounts(Object.fromEntries(totals) as Record<AlertSeverity, number>)
    },
    enabled,
    refetchInterval,
  })
}
