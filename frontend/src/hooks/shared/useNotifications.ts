import { useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/apis/shared/notifications.api'
import { onNotificationNew } from '@/lib/socket'
import { useToastStore } from '@/stores/toastStore'

const NOTIFICATIONS_KEY = ['notifications']

// hộp thông báo trong ứng dụng, tải thêm khi cuộn
export function useNotificationsInfinite(pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'infinite', pageSize],
    queryFn: ({ pageParam }) => notificationApi.list({ page: pageParam, limit: pageSize }).then(response => response.data),
    enabled,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
  })
}

// Số thông báo chưa đọc cho badge chuông (meta.unreadCount của GET /notifications)
export function useNotificationUnreadCount(): number {
  const { data } = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unread-count'],
    queryFn: () => notificationApi.list({ limit: 1 }).then(response => response.data.meta?.unreadCount ?? 0),
  })
  return data ?? 0
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

// Socket NOTIFICATION_NEW (room user:<id>): làm mới hộp thư và hiện toast, ở trang nào cũng vậy: mount 1 lần trong AppShell
export function useInAppNotificationListener(): void {
  const queryClient = useQueryClient()
  const push = useToastStore(s => s.push)
  useEffect(() => {
    const off = onNotificationNew(notification => {
      push(notification.title)
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
    })
    return () => { off() }
  }, [push, queryClient])
}
