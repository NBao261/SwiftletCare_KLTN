import api from '@/lib/axios'
import type { ApiResponse, AppNotification } from '@/types'

// EXPERT-FR-007 — hộp thông báo trong ứng dụng của người đang đăng nhập; meta.unreadCount không phụ thuộc bộ lọc `unread`
export const notificationApi = {
  list: (params: { page?: number; limit?: number; unread?: boolean }) =>
    api.get<ApiResponse<AppNotification[]>>('/notifications', {
      params: { page: params.page, limit: params.limit, unread: params.unread === undefined ? undefined : String(params.unread) },
    }),
  markRead: (id: string) => api.put<ApiResponse<AppNotification>>(`/notifications/${id}/read`),
  markAllRead: () => api.put<ApiResponse<{ modified: number }>>('/notifications/read-all'),
}
