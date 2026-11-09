import { useQuery } from '@tanstack/react-query'
import { PUMP_ON_CONFIRM_ALERT_STATUSES } from '@/constants/relayOverride'
import { alertApi } from '@/services/api/alert.api'
import { getPumpOnBlockingAlerts } from '@/utils/alert.utils'
import { MAX_PAGE_LIMIT } from '@/utils/pagination.utils'

// Cảnh báo đang mở của khu vực buộc hỏi lại trước khi bật bơm (ENV-FR-016): SENSOR_FAULT, RS485_BUS_FAILURE,
// MISTING_INEFFECTIVE ở trạng thái ACTIVE hoặc ACKNOWLEDGED. GET /alerts chỉ nhận một status nên gọi mỗi trạng thái
// một lần rồi gộp. Không dùng cache cũ: mỗi lần mở sheet bật bơm đều tải mới
export function usePumpBlockingAlerts(zoneId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['alerts', 'pump-blocking', zoneId],
    queryFn: async () => {
      const responses = await Promise.all(
        PUMP_ON_CONFIRM_ALERT_STATUSES.map(status =>
          alertApi.list({ zoneId, status, limit: String(MAX_PAGE_LIMIT) }),
        ),
      )
      return getPumpOnBlockingAlerts(responses.flatMap(response => response.data.data))
    },
    enabled: enabled && Boolean(zoneId),
    staleTime: 0,
    gcTime: 0,
  })
}
