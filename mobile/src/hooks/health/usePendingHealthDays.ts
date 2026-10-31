import { useQuery } from '@tanstack/react-query'
import type { PendingHealthDay } from '@/types'

// Các ngày đang chờ người dùng chấm (MF-11, BR-31)
export function usePendingHealthDays() {
  return useQuery({
    queryKey: ['health-days', 'pending-rating'],
    // shortcut: backend chưa có API ngày chờ chấm (gap G-11, chưa có trong api-spec) — khi có route thì gọi ở đây,
    // trả mảng PendingHealthDay; trước đó luôn rỗng nên "Việc chờ bạn" chỉ đếm cảnh báo chờ phán quyết
    queryFn: (): Promise<PendingHealthDay[]> => Promise.resolve([]),
  })
}
