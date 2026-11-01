import { useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { AlertVerdictResult } from '@/types'

export interface SetAlertVerdictInput {
  alertId: string
  result: AlertVerdictResult
  note?: string
}

// Chuyên gia xác nhận hoặc bác bỏ cảnh báo suy luận (EXPERT-FR-003); xong thì tải lại mọi danh sách cảnh báo
export function useSetAlertVerdict() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ alertId, result, note }: SetAlertVerdictInput) =>
      alertApi.setVerdict(alertId, result, note).then(response => response.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
