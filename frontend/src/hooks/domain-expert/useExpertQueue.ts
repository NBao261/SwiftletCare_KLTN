import { useQuery } from '@tanstack/react-query'
import { queueApi } from '@/apis/domain-expert/queue.api'

// Hàng đợi việc của trại đang chọn; làm mới khi quay lại trang để số khớp việc vừa xử lý
export function useExpertQueue(farmId: string | null | undefined) {
  return useQuery({
    queryKey: ['expert', 'queue', farmId],
    queryFn: () => queueApi.get(farmId as string).then(response => response.data.data),
    enabled: Boolean(farmId),
    refetchOnMount: 'always',
  })
}
