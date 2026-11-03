import { useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

// Số cảnh báo đang mở của cả Farm — chỉ cần meta.total nên tải 1 dòng. farmId null là mọi farm người dùng được xem
// (tab Farm đang ở "Tất cả trang trại"); chuỗi rỗng là farm chưa tải xong thì chưa gọi
export function useActiveAlertCount(farmId: string | null) {
  return useQuery({
    queryKey: ['alerts', 'active-count', farmId ?? 'all'],
    queryFn: () =>
      alertApi
        .list({ ...(farmId ? { farmId } : {}), status: 'ACTIVE', limit: '1' })
        .then(response => response.data.meta?.total ?? 0),
    enabled: farmId !== '',
  })
}
