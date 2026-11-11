import { useMutation, useQueryClient } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'
import type { HealthRatingValue } from '@/types'
import { storeRevealedHealthDay } from '@/utils/healthDay.utils'

export interface RateHealthDayInput {
  dayId: string
  rating: HealthRatingValue
  note?: string
}

// Chấm một ngày (EXPERT-FR-012); backend lưu điểm + ảnh chụp rồi mới trả ngày đầy đủ (BR-31).
// Không gửi lại tự động: lần đầu có thể đã lưu, gửi lại sẽ nhận 409
export function useRateHealthDay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ dayId, rating, note }: RateHealthDayInput) =>
      healthReportApi.rateDay(dayId, rating, note).then(response => response.data.data),
    retry: 0,
    onSuccess: day => storeRevealedHealthDay(queryClient, day),
  })
}
