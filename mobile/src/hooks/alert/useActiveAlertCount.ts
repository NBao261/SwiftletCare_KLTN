import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

// Số cảnh báo đang hiệu lực (ACTIVE + ACKNOWLEDGED, ALERT-FR-007 — khớp phần "Đang hiệu lực" của tab Cảnh báo) của cả Farm.
// Chỉ cần meta.total nên mỗi trạng thái tải 1 dòng. farmId null là mọi farm người dùng được xem (tab Farm đang ở "Tất cả
// trang trại"); chuỗi rỗng là farm chưa tải xong thì chưa gọi
export function useActiveAlertCount(farmId: string | null) {
  return useQuery({
    queryKey: ['alerts', 'active-count', farmId ?? 'all'],
    queryFn: async () => {
      const countStatus = (status: 'ACTIVE' | 'ACKNOWLEDGED') =>
        alertApi
          .list({ ...(farmId ? { farmId } : {}), status, limit: '1' })
          .then(response => response.data.meta?.total ?? 0)
      const [active, acknowledged] = await Promise.all([countStatus('ACTIVE'), countStatus('ACKNOWLEDGED')])
      return active + acknowledged
    },
    enabled: farmId !== '',
  })
}
