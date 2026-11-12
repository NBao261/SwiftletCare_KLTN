import { useMutation, useQueryClient } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'
import { readApiError } from '@/utils/apiError.utils'
import { refreshHealthDayLists, storeRevealedHealthDay } from '@/utils/healthDay.utils'

// Bỏ qua chấm một ngày không ra nhà yến (BR-31, SM-18 PENDING → SKIPPED); không hoàn tác được, không gửi lại tự động
export function useSkipHealthDay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dayId: string) => healthReportApi.skipDay(dayId).then(response => response.data.data),
    retry: 0,
    onSuccess: day => storeRevealedHealthDay(queryClient, day),
    // 409 RATING_CLOSED: ngày đã chốt ở nơi khác (web, máy khác, quá hạn) — danh sách chờ chấm và báo cáo phải tải lại
    onError: error => {
      if (readApiError(error).status === 409) void refreshHealthDayLists(queryClient)
    },
  })
}
