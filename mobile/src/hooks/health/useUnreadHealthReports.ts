import { useQueries, useQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'
import { notificationApi } from '@/services/api/notification.api'
import type { ZoneHealthReport } from '@/types'

// Số thông báo chưa đọc tối đa cần đọc để tìm báo cáo mới
const UNREAD_NOTIFICATION_LIMIT = '50'

export interface UnreadHealthReport {
  // Thông báo trỏ tới báo cáo — đánh dấu đọc thông báo này khi mở báo cáo
  notificationId: string
  report: ZoneHealthReport
}

// Báo cáo sức khoẻ người dùng chưa đọc: thông báo chưa đọc loại health_report, kèm chi tiết từng báo cáo
export function useUnreadHealthReports() {
  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'unread-health-reports'],
    queryFn: () =>
      notificationApi.list({ unread: 'true', limit: UNREAD_NOTIFICATION_LIMIT }).then(response => response.data.data),
  })
  const reportRefs = (notificationsQuery.data ?? []).flatMap(notification =>
    notification.ref?.kind === 'health_report' ? [{ notificationId: notification._id, reportId: notification.ref.id }] : [],
  )

  return useQueries({
    queries: reportRefs.map(({ reportId }) => ({
      queryKey: ['health-reports', reportId],
      queryFn: () => healthReportApi.getDetail(reportId).then(response => response.data.data),
    })),
    combine: (results): { reports: UnreadHealthReport[] } => ({
      reports: results.flatMap((result, index) =>
        result.data ? [{ notificationId: reportRefs[index].notificationId, report: result.data }] : [],
      ),
    }),
  })
}
