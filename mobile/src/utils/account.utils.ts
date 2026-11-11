import type { ChangeReviewStatus, FarmMember, ProposalStatus } from '@/types'
import { t } from '@/utils/i18n.utils'

const DAY_MS = 24 * 60 * 60 * 1000

// Tên các loại quyết định trong lịch sử hoạt động chuyên gia (EXPERT-FR-009) — khoá là mã action của GET /expert-activity
const EXPERT_ACTION_LABELS: Record<string, string> = {
  THRESHOLD_UPDATED: 'Sửa ngưỡng',
  FUZZY_TUNING_UPDATED: 'Sửa hệ số điều khiển',
  DETECTION_TUNING_UPDATED: 'Sửa tham số phát hiện',
  BIRD_COUNT_TUNING_UPDATED: 'Sửa mức giảm tỷ lệ về tổ',
  COUNTING_RING_UPDATED: 'Vẽ vòng đếm',
  ALERT_VERDICT_SET: 'Phán quyết cảnh báo',
  HEALTH_REPORT_CONCLUDED: 'Viết kết luận báo cáo',
  REVIEW_ACCEPTED: 'Chấp nhận thay đổi của chủ trại',
  REVIEW_REVERTED: 'Hoàn lại thay đổi của chủ trại',
  PROPOSAL_APPROVED: 'Duyệt gợi ý hệ số',
  PROPOSAL_REJECTED: 'Từ chối gợi ý hệ số',
}

// Trạng thái mục chờ duyệt (§6.10) và đề xuất gợi ý (§6.11)
const REVIEW_STATUS_LABELS: Record<ChangeReviewStatus | ProposalStatus, string> = {
  PENDING_REVIEW: 'Chờ chuyên gia duyệt',
  ACCEPTED: 'Đã chấp nhận',
  REVERTED: 'Đã hoàn tác',
  ADJUSTED: 'Chuyên gia đã chỉnh lại',
  PROPOSED: 'Đã gửi, chờ duyệt',
  APPROVED: 'Đã áp dụng',
  REJECTED: 'Bị từ chối',
  SUPERSEDED: 'Đã có đề xuất mới hơn',
}

// Mã action lạ (backend thêm loại mới) thì ghi chung "Quyết định khác"
export function getExpertActionLabel(action: string): string {
  return t(EXPERT_ACTION_LABELS[action] ?? 'Quyết định khác')
}

export function getReviewStatusLabel(status: ChangeReviewStatus | ProposalStatus): string {
  return t(REVIEW_STATUS_LABELS[status])
}

// Mục còn chờ chuyên gia xử lý
export function isReviewPending(status: ChangeReviewStatus | ProposalStatus): boolean {
  return status === 'PENDING_REVIEW' || status === 'PROPOSED'
}

// Kết quả phán quyết trong metadata của ALERT_VERDICT_SET; không có thì null
export function getActivityVerdict(metadata: Record<string, unknown> | undefined): 'CONFIRMED' | 'REJECTED' | null {
  const result = metadata?.result
  return result === 'CONFIRMED' || result === 'REJECTED' ? result : null
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
