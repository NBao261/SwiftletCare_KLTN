import { useQueries, useQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'
import { notificationApi } from '@/services/api/notification.api'
import type { ZoneHealthReport } from '@/types'
import { MAX_PAGE_LIMIT, fetchAllPages } from '@/utils/pagination.utils'

export interface UnreadHealthReport {
  // Thông báo trỏ tới báo cáo — đánh dấu đọc thông báo này khi có màn mở báo cáo
  notificationId: string
  report: ZoneHealthReport
}

// Báo cáo sức khoẻ người dùng chưa đọc: thông báo chưa đọc loại health_report, kèm chi tiết từng báo cáo
export function useUnreadHealthReports() {
  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'unread-health-reports'],
    // API không lọc theo loại thông báo nên tải đủ các trang chưa đọc rồi mới chọn loại health_report
    queryFn: () =>
      fetchAllPages(page =>
        notificationApi
          .list({ unread: 'true', limit: String(MAX_PAGE_LIMIT), page: String(page) })
          .then(response => ({ items: response.data.data, total: response.data.meta?.total ?? 0 })),
      ),
  })
  const reportRefs = (notificationsQuery.data ?? []).flatMap(notification =>
    notification.ref?.kind === 'health_report' ? [{ notificationId: notification._id, reportId: notification.ref.id }] : [],
  )

  return useQueries({
    queries: reportRefs.map(({ reportId }) => ({
      queryKey: ['health-reports', reportId],
      queryFn: () => healthReportApi.getDetail(reportId).then(response => response.data.data),
    })),
    combine: (results): { reports: UnreadHealthReport[]; isLoading: boolean; isError: boolean } => ({
      isLoading: notificationsQuery.isLoading || results.some(result => result.isLoading),
      isError: notificationsQuery.isError || results.some(result => result.isError),
      reports: results.flatMap((result, index) =>
        result.data ? [{ notificationId: reportRefs[index].notificationId, report: result.data }] : [],
      ),
    }),
  })
}
