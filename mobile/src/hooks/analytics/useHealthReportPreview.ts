import { useQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'

const DAY_MS = 24 * 60 * 60 * 1000

// Báo cáo khoảng tự chọn: số ngày gần nhất tính tới bây giờ (tối đa 30), backend không lưu (EXPERT-FR-005)
export function useHealthReportPreview(zoneId: string, days: number | null) {
  return useQuery({
    queryKey: ['health-reports', 'preview', zoneId, days],
    queryFn: () => {
      const to = Date.now()
      return healthReportApi
        .preview(zoneId, new Date(to - (days ?? 0) * DAY_MS).toISOString(), new Date(to).toISOString())
        .then(response => response.data.data)
    },
    enabled: Boolean(zoneId) && days !== null,
  })
}
