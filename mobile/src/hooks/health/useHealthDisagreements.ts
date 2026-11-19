import { useQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'

// Ngày của một nhà có lượt chấm lệch với trạng thái hệ thống (EXPERT-FR-022), mới nhất trước
export function useHealthDisagreements(houseId: string, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['health-disagreements', houseId, from, to],
    queryFn: () =>
      healthReportApi
        .listDisagreements(houseId, from, to)
        .then(response => [...response.data.data.days].sort((left, right) => right.date.localeCompare(left.date))),
    enabled: enabled && Boolean(houseId),
  })
}
