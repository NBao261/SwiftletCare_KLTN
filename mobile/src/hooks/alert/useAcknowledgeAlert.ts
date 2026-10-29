import { useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

interface AcknowledgeAlertPayload {
  alertId: string
  note?: string
}

// Farm Owner xác nhận cảnh báo (ALERT-FR-009), xong làm mới danh sách cảnh báo
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ alertId, note }: AcknowledgeAlertPayload) => alertApi.acknowledge(alertId, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
