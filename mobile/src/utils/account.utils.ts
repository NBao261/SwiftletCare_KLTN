import type { ExpertDecisionType, FarmMember, ReviewItem } from '@/types'
import { t } from '@/utils/i18n.utils'

const DAY_MS = 24 * 60 * 60 * 1000

// Các loại quyết định chuyên gia Farm Owner được báo (EXPERT-FR-009)
const DECISION_TYPE_LABELS: Record<ExpertDecisionType, string> = {
  THRESHOLDS: 'Sửa ngưỡng',
  THRESHOLDS_RESET: 'Đặt lại ngưỡng mặc định',
  FUZZY_TUNING: 'Sửa hệ số điều khiển',
  DETECTION_TUNING: 'Sửa tham số phát hiện',
  RETURN_RATE_DROP: 'Sửa mức giảm tỷ lệ về tổ',
  COUNTING_RING: 'Vẽ vòng đếm',
  COUNTING_SCHEDULE: 'Đặt lịch đếm chim',
  ALERT_VERDICT: 'Phán quyết cảnh báo',
  CONCLUSION: 'Viết kết luận báo cáo',
  CHANGE_REVIEW: 'Duyệt thay đổi của chủ trại',
  SUGGESTION_APPROVAL: 'Duyệt gợi ý hệ số',
}

// Trạng thái mục chờ duyệt (§6.10) và đề xuất gợi ý (§6.11)
const REVIEW_STATUS_LABELS: Record<ReviewItem['status'], string> = {
  PENDING_REVIEW: 'Chờ chuyên gia duyệt',
  ACCEPTED: 'Đã chấp nhận',
  REVERTED: 'Đã hoàn tác',
  ADJUSTED: 'Chuyên gia đã chỉnh lại',
  PROPOSED: 'Đã gửi, chờ duyệt',
  APPROVED: 'Đã áp dụng',
  REJECTED: 'Bị từ chối',
  SUPERSEDED: 'Đã có đề xuất mới hơn',
}

export function getDecisionTypeLabel(type: ExpertDecisionType): string {
  return t(DECISION_TYPE_LABELS[type])
}

export function getReviewStatusLabel(status: ReviewItem['status']): string {
  return t(REVIEW_STATUS_LABELS[status])
}

// Mục còn chờ chuyên gia xử lý
export function isReviewPending(status: ReviewItem['status']): boolean {
  return status === 'PENDING_REVIEW' || status === 'PROPOSED'
}

// Vai trò của một thành viên trong farm: chủ chính, đồng sở hữu hoặc chuyên gia (member cũ không có role là đồng sở hữu)
export function getMemberRoleLabel(member: FarmMember, ownerId: string): string {
  if (member.is_primary || member.user_id === ownerId) return t('Chủ chính')
  if (member.role === 'DOMAIN_EXPERT') return t('Chuyên gia')
  return t('Đồng sở hữu')
}

// Thứ tự danh sách thành viên: chủ chính → đồng sở hữu → chuyên gia, cùng nhóm thì vào trước đứng trước
export function sortMembers(members: FarmMember[], ownerId: string): FarmMember[] {
  const rank = (member: FarmMember) =>
    member.is_primary || member.user_id === ownerId ? 0 : member.role === 'DOMAIN_EXPERT' ? 2 : 1
  return [...members].sort((first, second) => rank(first) - rank(second) || first.joined_at.localeCompare(second.joined_at))
}

// Số ngày còn lại tới một hạn (lời mời 7 ngày, yêu cầu xoá 30 ngày); đã quá hạn thì 0
export function getDaysLeft(deadline: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / DAY_MS))
}

// Hạn Administrator phải xử lý yêu cầu xoá tài khoản: 30 ngày sau khi gửi (AUTH-FR-012)
const DELETION_DEADLINE_DAYS = 30

export function getDeletionDeadline(requestedAt: string): string {
  return new Date(Date.parse(requestedAt) + DELETION_DEADLINE_DAYS * DAY_MS).toISOString()
}

// Chữ cái đầu cho ảnh đại diện mặc định: chữ đầu của từ cuối (tên) theo cách gọi tên tiếng Việt
export function getInitial(fullName: string | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return (words[words.length - 1]?.[0] ?? '?').toUpperCase()
}
