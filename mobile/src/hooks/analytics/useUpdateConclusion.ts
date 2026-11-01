import { useMutation, useQueryClient } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'

export interface UpdateConclusionInput {
  reportId: string
  text: string
}

// Chuyên gia viết hoặc sửa kết luận báo cáo (EXPERT-FR-006); xong thì tải lại danh sách báo cáo
export function useUpdateConclusion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ reportId, text }: UpdateConclusionInput) =>
      healthReportApi.updateConclusion(reportId, text).then(response => response.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health-reports'] }),
  })
}
