import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expertApi, type InferredAlertsQueryParams } from '@/services/api/expert.api'
import type { VerdictResult } from '@/types'

/**
 * Hook lấy danh sách cảnh báo suy luận cần Chuyên gia thẩm định (EXPERT-FR-003, ALERT-FR-007)
 */
export function useInferredAlerts(params?: InferredAlertsQueryParams) {
  return useQuery({
    queryKey: ['expert', 'inferred-alerts', params],
    queryFn: () => expertApi.getInferredAlerts(params).then(res => res.data),
  })
}

/**
 * Hook lấy chi tiết bằng chứng viễn trắc đa phương thức ±30 phút (ALERT-FR-014)
 */
export function useAlertEvidence(alertId: string) {
  return useQuery({
    queryKey: ['expert', 'alert-evidence', alertId],
    queryFn: () => expertApi.getAlertEvidence(alertId).then(res => res.data.data),
    enabled: Boolean(alertId),
  })
}

/**
 * Hook lấy thống kê tỷ lệ phán quyết chuyên gia theo từng loại cảnh báo (EXPERT-FR-008)
 */
export function useVerdictStats(params?: { farm_id?: string; zone_id?: string }) {
  return useQuery({
    queryKey: ['expert', 'verdict-stats', params],
    queryFn: () => expertApi.getVerdictStats(params).then(res => res.data),
  })
}

/**
 * Hook thực hiện phán quyết cảnh báo suy luận (CONFIRMED hoặc REJECTED)
 */
export function useSetAlertVerdict() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      alertId,
      result,
      note,
    }: {
      alertId: string
      result: VerdictResult
      note?: string
    }) => expertApi.setAlertVerdict(alertId, result, note),
    onSuccess: () => {
      // Làm mới danh sách cảnh báo và thống kê phán quyết
      queryClient.invalidateQueries({ queryKey: ['expert', 'inferred-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['expert', 'verdict-stats'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
