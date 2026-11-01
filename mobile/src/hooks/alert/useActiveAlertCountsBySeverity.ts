import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { AlertSeverity } from '@/types'

const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

// Số cảnh báo đang hiệu lực của một Farm theo từng mức — chỉ cần meta.total nên mỗi mức tải 1 dòng
export function useActiveAlertCountsBySeverity(farmId: string) {
  return useQuery({
    queryKey: ['alerts', 'active-by-severity', farmId],
    queryFn: async (): Promise<Record<AlertSeverity, number>> => {
      const totals = await Promise.all(
        SEVERITIES.map(severity =>
          alertApi
            .list({ farmId, severity, status: 'ACTIVE', limit: '1' })
            .then(response => response.data.meta?.total ?? 0),
        ),
      )
      return { CRITICAL: totals[0], HIGH: totals[1], MEDIUM: totals[2], LOW: totals[3] }
    },
    enabled: Boolean(farmId),
  })
}
