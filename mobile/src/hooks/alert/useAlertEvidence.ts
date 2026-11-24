import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

// Bằng chứng của cảnh báo suy luận do backend tổng hợp (ALERT-FR-014, GET /alerts/{id}/evidence): cửa sổ ±30 phút
// (BR-23) hoặc ngày của phiên với LOW_RETURN_RATE. Khoá chỉ theo id nên không tải lại theo đồng hồ; chỉ tải sau khi sheet
// mở xong để mở không bị chậm
export function useAlertEvidence(alertId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['alerts', 'evidence', alertId],
    queryFn: () => alertApi.getEvidence(alertId).then(response => response.data.data),
    enabled: enabled && Boolean(alertId),
  })
}
