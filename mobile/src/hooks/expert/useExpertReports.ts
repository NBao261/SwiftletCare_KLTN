import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expertApi } from '@/services/api/expert.api'
import type { HouseHealthReportKind } from '@/types'

/**
 * Hook lấy danh sách báo cáo sức khỏe theo nhà (EXPERT-FR-005, EXPERT-FR-013).
 * Hàng đợi chuyên gia truyền has_conclusion=false để chỉ lấy báo cáo chờ kết luận.
 */
export function useHealthReports(params?: {
  farm_id?: string
  house_id?: string
  kind?: HouseHealthReportKind
  has_conclusion?: boolean
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['expert', 'health-reports', params],
    queryFn: () => expertApi.getHealthReports(params).then(res => res.data),
    enabled: Boolean(params?.farm_id || params?.house_id),
  })
}

/**
 * Hook lấy chi tiết một báo cáo sức khỏe
 */
export function useHealthReportDetail(reportId: string) {
  return useQuery({
    queryKey: ['expert', 'health-report-detail', reportId],
    queryFn: () => expertApi.getHealthReportDetail(reportId).then(res => res.data),
    enabled: Boolean(reportId),
  })
}

/**
 * Hook ban hành kết luận và khuyến nghị chuyên môn vào báo cáo sức khỏe (EXPERT-FR-006)
 */
export function useSetReportConclusion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ reportId, text }: { reportId: string; text: string }) =>
      expertApi.setReportConclusion(reportId, text),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expert', 'health-reports'] })
      queryClient.invalidateQueries({ queryKey: ['expert', 'health-report-detail', vars.reportId] })
    },
  })
}

/**
 * Hook lấy nhật ký hoạt động chuyên gia (EXPERT-FR-009, S13)
 */
export function useExpertActivity(farmId: string, params?: Parameters<typeof expertApi.getExpertActivity>[1]) {
  return useQuery({
    queryKey: ['expert', 'activity', farmId, params],
    queryFn: () => expertApi.getExpertActivity(farmId, params).then(res => res.data),
    enabled: Boolean(farmId),
  })
}

