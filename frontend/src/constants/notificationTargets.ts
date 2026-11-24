import { canAccessPath } from '@/constants/roles'
import { HEALTH_REPORT_PATH, type HealthReportState } from '@/components/common/healthReport.utils'
import type { AppNotification, Role } from '@/types'

export interface NotificationTarget {
  path: string
  state?: HealthReportState
}

// Trang mở ra khi bấm một thông báo trong ứng dụng; null = chỉ đánh dấu đã đọc
export function notificationTarget(notification: Pick<AppNotification, 'ref'>, role: Role | undefined): NotificationTarget | null {
  const ref = notification.ref
  let target: NotificationTarget | null = null
  if (!ref) {
    // Thông báo không gắn đối tượng của Administrator là yêu cầu xoá tài khoản và lời nhắc
    target = role === 'ADMIN' ? { path: '/account-requests' } : null
  } else if (ref.kind === 'alert') {
    target = role === 'DOMAIN_EXPERT'
      ? { path: `/domain-expert/alert-verdicts?alertId=${ref.id}` }
      : { path: `/alerts?highlight=${ref.id}` }
  } else if (ref.kind === 'health_report') {
    target = { path: HEALTH_REPORT_PATH, state: { reportId: ref.id } }
  } else if (ref.kind === 'health_day') {
    target = { path: '/health' }
  } else if (ref.kind === 'expert_decision') {
    target = { path: '/domain-expert/history' }
  } else if (ref.kind === 'parameter_review' || ref.kind === 'coefficient_proposal') {
    target = { path: '/domain-expert/reviews' }
  } else if (ref.kind === 'weather_rules') {
    // đề xuất luật của Farm Owner chờ duyệt; trang chọn nhà ở thanh lọc
    target = { path: '/domain-expert/weather-rules' }
  } else if (ref.kind === 'config_profile') {
    target = { path: '/domain-expert/profiles' }
  } else if (ref.kind === 'recommendation_rule') {
    target = { path: '/domain-expert/recommendation-rules' }
  } else if (ref.kind === 'harvest_cycle') {
    // Lời nhắc viết kết luận mùa vụ: chuyên gia viết ở trang báo cáo và kết luận
    target = { path: '/domain-expert/reports' }
  } else if (ref.kind === 'work_order') {
    target = { path: '/work-orders' }
  } else if (ref.kind === 'device_action') {
    target = { path: '/devices' }
  }
  // Role không vào được trang đích thì chỉ đánh dấu đã đọc, không đưa về /403
  if (target && !canAccessPath(role, target.path.split('?')[0])) return null
  return target
}
