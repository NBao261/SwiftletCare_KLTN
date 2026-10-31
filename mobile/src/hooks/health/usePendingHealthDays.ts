import { useQuery } from '@tanstack/react-query'
import type { PendingHealthDay } from '@/types'

// shortcut: backend chưa có API ngày chờ chấm (gap G-11, chưa có trong api-spec) — có route thì gọi trong queryFn
// và đổi cờ này thành true; trước đó khối "Việc chờ bạn" ghi "Sắp có" cho phần này thay vì đếm 0
export const HAS_PENDING_HEALTH_DAYS_API = false

// Các ngày đang chờ người dùng chấm (MF-11, BR-31)
export function usePendingHealthDays() {
  return useQuery({
    queryKey: ['health-days', 'pending-rating'],
    queryFn: (): Promise<PendingHealthDay[]> => Promise.resolve([]),
    enabled: HAS_PENDING_HEALTH_DAYS_API,
  })
}
