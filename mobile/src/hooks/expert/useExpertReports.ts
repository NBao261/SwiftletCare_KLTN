import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expertApi } from '@/services/api/expert.api'
import type { DailyHealthStatus } from '@/types'

/**
 * Hook lấy danh sách báo cáo sức khỏe nhà yến (EXPERT-FR-005, EXPERT-FR-013)
 */
export function useHealthReports(params?: {
  farm_id?: string
  zone_id?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['expert', 'health-reports', params],
    queryFn: () => expertApi.getHealthReports(params).then(res => res.data),
    enabled: Boolean(params?.zone_id),
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
 * Hook lấy trạng thái đánh giá ngày độc lập theo quy tắc mù BR-31 (EXPERT-FR-012)
 */
export function useDayRating(houseId: string, date: string) {
  return useQuery({
    queryKey: ['expert', 'day-rating', houseId, date],
    queryFn: () => expertApi.getDayRating(houseId, date).then(res => res.data),
    enabled: Boolean(houseId && date),
  })
}

/**
 * Hook gửi kết quả đánh giá ngày độc lập 2 bước của Chuyên gia (EXPERT-FR-012, BR-31)
 */
export function useSubmitDayRating() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      houseId,
      date,
      status,
      note,
    }: {
      houseId: string
      date: string
      status: DailyHealthStatus
      note?: string
    }) => expertApi.submitDayRating(houseId, date, status, note),
    onSuccess: (res, vars) => {
      if (res?.data) {
        queryClient.setQueryData(['expert', 'day-rating', vars.houseId, vars.date], res.data)
      }
      queryClient.invalidateQueries({ queryKey: ['expert', 'day-rating', vars.houseId, vars.date] })
      queryClient.invalidateQueries({ queryKey: ['expert', 'health-reports'] })
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

