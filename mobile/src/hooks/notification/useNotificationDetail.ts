import { useNotifications } from '@/hooks/notification/useNotifications'
import { findNotificationInPages } from '@/utils/notification.utils'

// Một thông báo theo id, lấy từ hộp thư đã tải (backend không có GET /notifications/{id}); mở thẳng trang khi cache trống thì
// tải trang đầu của hộp thư rồi tìm trong đó
export function useNotificationDetail(notificationId: string) {
  const query = useNotifications()

  return {
    notification: findNotificationInPages(query.data, notificationId),
    isLoading: query.isLoading,
    isError: query.isError,
    retry: () => query.refetch(),
  }
}
