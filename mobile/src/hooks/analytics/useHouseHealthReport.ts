import { useQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'

// Chi tiết một báo cáo theo nhà: các ngày (che theo BR-31), số liệu từng Zone, kết luận của chuyên gia
export function useHouseHealthReport(reportId: string | null) {
  return useQuery({
    queryKey: ['health-reports', reportId],
    queryFn: () => healthReportApi.getHouseReport(reportId ?? '').then(response => response.data.data),
    enabled: Boolean(reportId),
  })
}
