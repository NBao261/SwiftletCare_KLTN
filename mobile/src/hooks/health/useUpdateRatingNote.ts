import { useMutation, useQueryClient } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'
import { storeRevealedHealthDay } from '@/utils/healthDay.utils'

export interface UpdateRatingNoteInput {
  dayId: string
  note: string
}

// Thay ghi chú của điểm đã chấm (SM-18 RATED → RATED); mức đã chấm không đổi được
export function useUpdateRatingNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ dayId, note }: UpdateRatingNoteInput) =>
      healthReportApi.updateRatingNote(dayId, note).then(response => response.data.data),
    onSuccess: day => storeRevealedHealthDay(queryClient, day),
  })
}
