/**
 * useHealthReportList — báo cáo tuần theo Zone (deprecated), còn cho trang Việc chờ và banner SCADA của chuyên gia;
 * tab Báo cáo & Kết luận dùng báo cáo theo nhà (hooks/shared/useHealthDays)
 */
import { useQuery } from '@tanstack/react-query'
import { expertService } from '@/services/expert.service'
import type { ZoneHealthReportItem } from '@/types/expert.types'

export function useHealthReportList(zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'health-reports', zoneId],
    queryFn: async (): Promise<ZoneHealthReportItem[]> => {
      if (!zoneId) return []
      const data = await expertService.getHealthReports(zoneId)
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(zoneId),
    staleTime: 10 * 60_000,
  })
}
