import { useInfiniteQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'

const PAGE_SIZE = 50

// Cảnh báo đã đóng (RESOLVED) của một farm, mới nhất trước, tải thêm khi cuộn; chỉ tải khi mở phần "Đã đóng"
export function useResolvedAlertList(farmId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['alerts', 'list', 'resolved', farmId],
    queryFn: ({ pageParam }) =>
      alertApi
        .list({ farmId, status: 'RESOLVED', page: String(pageParam), limit: String(PAGE_SIZE) })
        .then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
    enabled: enabled && Boolean(farmId),
  })
}
