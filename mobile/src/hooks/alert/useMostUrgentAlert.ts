import { useQueries } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { AlertSeverity } from '@/types'
import { pickMostUrgentAlert } from '@/utils/alert.utils'

// Hỏi riêng từng mức để không bỏ sót: cảnh báo nặng nhất có thể cũ hơn nhiều cảnh báo nhẹ mới
const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

// Cảnh báo đang mở khẩn nhất của mọi Farm: mỗi mức lấy cảnh báo mới nhất (backend sắp mới trước), rồi chọn mức cao nhất
export function useMostUrgentAlert() {
  return useQueries({
    queries: SEVERITIES.map(severity => ({
      queryKey: ['alerts', 'newest-active', severity],
      queryFn: () => alertApi.list({ status: 'ACTIVE', severity, limit: '1' }).then(response => response.data.data),
    })),
    combine: results => ({
      alert: pickMostUrgentAlert(results.flatMap(result => result.data ?? [])),
      isLoading: results.some(result => result.isLoading),
    }),
  })
}
