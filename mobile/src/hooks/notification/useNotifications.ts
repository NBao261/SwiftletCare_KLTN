import { useInfiniteQuery } from '@tanstack/react-query'
import { notificationApi } from '@/services/api/notification.api'

const PAGE_SIZE = 30

// Hộp thông báo trong app của người dùng (EXPERT-FR-007), mới nhất trước, tải thêm khi cuộn theo meta.total
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam }) =>
      notificationApi.list({ page: String(pageParam), limit: String(PAGE_SIZE) }).then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
  })
}
