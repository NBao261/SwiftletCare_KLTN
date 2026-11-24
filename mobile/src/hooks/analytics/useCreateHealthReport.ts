import { useMutation, useQueryClient } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'

export interface CreateHealthReportInput {
  houseId: string
  // YYYY-MM-DD giờ Việt Nam, tính cả hai đầu
  from: string
  to: string
}

// Tạo báo cáo theo yêu cầu của một nhà (EXPERT-FR-005); xong thì tải lại danh sách báo cáo
export function useCreateHealthReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, from, to }: CreateHealthReportInput) =>
      healthReportApi.createCustomReport(houseId, from, to).then(response => response.data.data),
    onSuccess: report => {
      queryClient.setQueryData(['health-reports', report._id], report)
      return queryClient.invalidateQueries({ queryKey: ['health-reports', 'house', report.house_id] })
    },
  })
}
