import type {
  BirdCountTuning,
  ChangeReviewStatus,
  DetectionTuning,
  ExpertActivityEntry,
  FarmMember,
  InvitedRole,
  FuzzyTuning,
  ProposalStatus,
  Thresholds,
} from '@/types'
import {
  getBirdCountTuningLabel,
  getDetectionTuningLabel,
  getFuzzyTuningLabel,
  getThresholdKeyLabel,
} from '@/utils/label.utils'
import { formatStoredNumber } from '@/utils/settingsValidation.utils'
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

// Tên vai trò được mời (lời mời đang chờ)
export function getInvitedRoleLabel(role: InvitedRole): string {
  if (role === 'DOMAIN_EXPERT') return t('Chuyên gia')
  if (role === 'FARM_TECHNICIAN') return t('Kỹ thuật viên nhà yến')
  return t('Đồng sở hữu')
}

// Một câu về quyền của vai trò được mời (Report 3 §2.4), hiện dưới ô chọn vai trò khi mời. Kỹ thuật viên chưa làm được gì tới
// khi được giao nhà (AUTH-FR-013); màn giao nhà hiện có ở bản web
export function getInvitedRoleDescription(role: InvitedRole): string {
  if (role === 'DOMAIN_EXPERT') {
    return t('Chuyên gia xem toàn farm, kiểm chứng cảnh báo suy luận, chỉnh ngưỡng và tham số; không điều khiển relay.')
  }
  if (role === 'FARM_TECHNICIAN') {
    return t('Kỹ thuật viên chỉ làm ở nhà được giao: nhận và xác nhận cảnh báo, bật tắt thiết bị; không sửa cài đặt. Nhận lời mời xong, giao nhà cho họ trên bản web.')
  }
  return t('Đồng sở hữu có quyền như chủ trại, trừ xoá farm và mời, gỡ thành viên.')
}

// Vai trò của một thành viên trong farm: chủ chính, đồng sở hữu, chuyên gia hoặc kỹ thuật viên (member cũ không có role là đồng
// sở hữu)
export function getMemberRoleLabel(member: FarmMember, ownerId: string): string {
  if (member.is_primary || member.user_id === ownerId) return t('Chủ chính')
  return getInvitedRoleLabel(member.role ?? 'FARM_OWNER')
}

// Nhóm của thành viên khi xếp danh sách: chủ chính → đồng sở hữu → chuyên gia → kỹ thuật viên
const MEMBER_ROLE_RANK: Record<InvitedRole, number> = { FARM_OWNER: 1, DOMAIN_EXPERT: 2, FARM_TECHNICIAN: 3 }

// Thứ tự danh sách thành viên theo nhóm trên, cùng nhóm thì vào trước đứng trước
export function sortMembers(members: FarmMember[], ownerId: string): FarmMember[] {
  const rank = (member: FarmMember) =>
    member.is_primary || member.user_id === ownerId ? 0 : MEMBER_ROLE_RANK[member.role ?? 'FARM_OWNER']
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

// Tên và đơn vị của một khoá giá trị trong nhật ký (ngưỡng, hệ số điều khiển, tham số phát hiện, đếm chim) — đúng tên trường
// backend lưu ở metadata.before / after. Khoá lạ thì null: không bao giờ hiện mã trường thô
const THRESHOLD_KEYS = new Set<string>(['temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'light_max', 'nh3_max', 'co2_max'])
const FUZZY_KEYS = new Set<string>(['fuzzy_humidity_band', 'fuzzy_temp_band', 'fuzzy_fan_dry_level', 'fuzzy_window_sec', 'fuzzy_input_filter'])
const DETECTION_KEYS = new Set<string>(['noise_margin_db', 'noise_min_sec', 'pump_dry_on_sec', 'pump_dry_min_rise_pct', 'speaker_drop_pct'])
const BIRD_COUNT_KEYS = new Set<string>(['return_rate_drop_pct'])

function getChangeKeyLabel(key: string): { label: string; unit: string } | null {
  if (THRESHOLD_KEYS.has(key)) return getThresholdKeyLabel(key as keyof Thresholds)
  if (FUZZY_KEYS.has(key)) return getFuzzyTuningLabel(key as keyof FuzzyTuning)
  if (DETECTION_KEYS.has(key)) return getDetectionTuningLabel(key as keyof DetectionTuning)
  if (BIRD_COUNT_KEYS.has(key)) return getBirdCountTuningLabel(key as keyof BirdCountTuning)
  return null
}

// Một giá trị trong nhật ký: số theo kiểu Việt Nam kèm đơn vị, công tắc là Bật / Tắt, không có thì "_"
function formatChangeValue(value: unknown, unit: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `${formatStoredNumber(value)}${unit}`
  if (typeof value === 'boolean') return value ? t('Bật') : t('Tắt')
  return '_'
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

// Các dòng "Độ ẩm thấp nhất: 75% → 80%" cho mọi giá trị đổi giữa before và after; giá trị không đổi thì bỏ
function describeValueChanges(before: unknown, after: unknown): string[] {
  const afterValues = asRecord(after)
  if (!afterValues) return []
  const beforeValues = asRecord(before) ?? {}
  const lines: string[] = []
  for (const [key, newValue] of Object.entries(afterValues)) {
    const oldValue = beforeValues[key]
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue
    const keyLabel = getChangeKeyLabel(key)
    if (!keyLabel) continue
    lines.push(
      oldValue === undefined || oldValue === null
        ? `${keyLabel.label}: ${formatChangeValue(newValue, keyLabel.unit)}`
        : `${keyLabel.label}: ${formatChangeValue(oldValue, keyLabel.unit)} → ${formatChangeValue(newValue, keyLabel.unit)}`,
    )
  }
  return lines
}

// Thay đổi chủ trại chờ duyệt (old_values → new_values) và gợi ý hệ số đã gửi (current_values → suggested_values): cùng cách ghi
// "chỉ số: cũ → mới" như lịch sử quyết định
export function describeValueDiff(oldValues: unknown, newValues: unknown): string[] {
  return describeValueChanges(oldValues, newValues)
}

// Đoạn "khoá cũ → mới" backend viết trong nội dung thông báo (formatChanges của expertActivity.service, ví dụ
// "humidity_min 75 → 80, fuzzy_input_filter true → false"): đổi sang "Độ ẩm thấp nhất: 75% → 80%". Khoá lạ giữ nguyên
const RAW_CHANGE_PATTERN = /\b([a-z][a-z0-9_]*) (-?\d+(?:\.\d+)?|true|false|null) → (-?\d+(?:\.\d+)?|true|false|null)/g

const parseRawValue = (raw: string): unknown => (raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : Number(raw))

export function humanizeChangeText(text: string): string {
  return text.replace(RAW_CHANGE_PATTERN, (match, key: string, oldRaw: string, newRaw: string) => {
    const keyLabel = getChangeKeyLabel(key)
    if (!keyLabel) return match
    const oldValue = parseRawValue(oldRaw)
    const newText = formatChangeValue(parseRawValue(newRaw), keyLabel.unit)
    return oldValue === null
      ? `${keyLabel.label}: ${newText}`
      : `${keyLabel.label}: ${formatChangeValue(oldValue, keyLabel.unit)} → ${newText}`
  })
}

// Vòng đếm mới: số đỉnh và phía nào là trong vòng (VISION-FR-018)
function describeCountingRing(after: unknown): string[] {
  const ring = asRecord(after)
  if (!ring || !Array.isArray(ring.points)) return []
  return [
    t('Vòng đếm {count} đỉnh, {side}', {
      count: ring.points.length,
      side: ring.into_ring_is_exit ? t('trong vòng là phía ngoài trời') : t('trong vòng là phía trong nhà'),
    }),
  ]
}

// Chi tiết một quyết định trong lịch sử hoạt động: chỉ số nào đổi, từ bao nhiêu thành bao nhiêu, đặt lại mặc định hay áp gợi
// ý, ghi chú / lý do — dựng từ metadata backend lưu kèm (before, after, source, note)
export function describeActivityChanges(entry: Pick<ExpertActivityEntry, 'action' | 'metadata'>): string[] {
  const metadata = entry.metadata ?? {}
  const note = typeof metadata.note === 'string' && metadata.note.trim() ? metadata.note.trim() : null
  const lines: string[] = []

  if (metadata.source === 'RESET_TO_DEFAULT') lines.push(t('Đặt lại về mặc định hệ thống'))
  if (metadata.source === 'SUGGESTION_APPROVED') lines.push(t('Áp gợi ý hệ số của hệ thống'))

  if (entry.action === 'COUNTING_RING_UPDATED') {
    lines.push(...describeCountingRing(metadata.after))
  } else {
    lines.push(...describeValueChanges(metadata.before, metadata.after))
  }

  if (note) lines.push(entry.action === 'PROPOSAL_REJECTED' ? t('Lý do: {note}', { note }) : t('Ghi chú: {note}', { note }))
  return lines
}
