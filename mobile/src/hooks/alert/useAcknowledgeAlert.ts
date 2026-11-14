import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateAlertQueries } from '@/config/queryClient'
import { alertApi } from '@/services/api/alert.api'
import type { SiteCause } from '@/types'
import { readApiError } from '@/utils/apiError.utils'
import { ALERT_BADGE_KEY } from '@/utils/notification.utils'

interface AcknowledgeAlertPayload {
  alertId: string
  note?: string
  // Nguyên nhân tìm thấy tại chỗ của cảnh báo thiết bị (ALERT-FR-018), không bắt buộc
  cause?: SiteCause
}

// Farm Owner và kỹ thuật viên nhà được giao xác nhận cảnh báo (ALERT-FR-009, 018). Chỉ cảnh báo ACTIVE mới có nút xác nhận, nên số chưa xác nhận trên chuông và
// tab giảm ngay, lỗi thì trả lại; xong làm mới danh sách cảnh báo. Cảnh báo vừa đổi trạng thái (409) thì cũng làm mới
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ alertId, note, cause }: AcknowledgeAlertPayload) => alertApi.acknowledge(alertId, note, cause),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ALERT_BADGE_KEY })
      const previousBadge = queryClient.getQueryData<number>(ALERT_BADGE_KEY)
      queryClient.setQueryData<number>(ALERT_BADGE_KEY, count => (count === undefined ? count : Math.max(0, count - 1)))
      return { previousBadge }
    },
    onError: (error, _payload, context) => {
      if (context?.previousBadge !== undefined) queryClient.setQueryData(ALERT_BADGE_KEY, context.previousBadge)
      if (readApiError(error).status === 409) void invalidateAlertQueries(queryClient)
    },
    onSuccess: () => {
      void invalidateAlertQueries(queryClient)
    },
  })
}
