import type {
  BirdCountTuning,
  ChangeReviewStatus,
  CoefficientProposal,
  DetectionTuning,
  ExpertActivityEntry,
  FarmMember,
  InvitedRole,
  FuzzyTuning,
  HealthLevels,
  ParameterReview,
  ProposalStatus,
  Thresholds,
} from '@/types'
import {
  getBirdCountTuningLabel,
  getDetectionTuningLabel,
  getFuzzyTuningLabel,
  getHealthLevelLabel,
  getParameterReviewGroupLabel,
  getRoleLabel,
  getThresholdKeyLabel,
} from '@/utils/label.utils'
import { formatDateTime } from '@/utils/date.utils'
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
  HEALTH_LEVELS_UPDATED: 'Sửa mức chỉ số sức khỏe',
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

// Đếm thành viên theo nhóm của danh sách (chủ chính, đồng sở hữu, chuyên gia, kỹ thuật viên), chỉ ghi nhóm có người:
// "1 chủ chính · 2 kỹ thuật viên nhà yến"
export function summarizeMembers(members: FarmMember[], ownerId: string): string {
  const countByLabel = new Map<string, number>()
  for (const member of sortMembers(members, ownerId)) {
    const label = getMemberRoleLabel(member, ownerId)
    countByLabel.set(label, (countByLabel.get(label) ?? 0) + 1)
  }
  return [...countByLabel].map(([label, count]) => `${count} ${label.toLowerCase()}`).join(' · ')
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
const HEALTH_LEVEL_KEYS = new Set<string>([
  'in_range_slight_pct',
  'in_range_clear_pct',
  'air_slight_h',
  'air_clear_h',
  'noise_slight',
  'noise_clear',
])

function getChangeKeyLabel(key: string): { label: string; unit: string } | null {
  if (THRESHOLD_KEYS.has(key)) return getThresholdKeyLabel(key as keyof Thresholds)
  if (FUZZY_KEYS.has(key)) return getFuzzyTuningLabel(key as keyof FuzzyTuning)
  if (DETECTION_KEYS.has(key)) return getDetectionTuningLabel(key as keyof DetectionTuning)
  if (BIRD_COUNT_KEYS.has(key)) return getBirdCountTuningLabel(key as keyof BirdCountTuning)
  if (HEALTH_LEVEL_KEYS.has(key)) {
    // Đơn vị mức sức khỏe không có dấu cách đầu ("giờ", "đợt") nên thêm vào, trừ "%" viết liền số
    const { label, unit } = getHealthLevelLabel(key as keyof HealthLevels)
    return { label, unit: unit === '%' ? unit : ` ${unit}` }
  }
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

// Một vòng đếm: số đỉnh và phía nào là trong vòng (VISION-FR-018)
function describeOneRing(ring: Record<string, unknown>, points: unknown[]): string {
  return t('Vòng đếm {count} đỉnh, {side}', {
    count: points.length,
    side: ring.into_ring_is_exit ? t('trong vòng là phía ngoài trời') : t('trong vòng là phía trong nhà'),
  })
}

// Vòng đếm sau khi đổi. Backend lưu 2 kiểu: danh sách 0–4 vòng (bản mới, [] là đã xoá và camera dùng lại vòng mặc định)
// hoặc một vòng (mục cũ trước khi camera có nhiều vòng); không có dữ liệu thì không ghi gì
function describeCountingRing(after: unknown): string[] {
  if (after === undefined || after === null) return []
  const rings = Array.isArray(after) ? after : [after]
  if (rings.length === 0) return [t('Xoá vòng đếm, camera dùng lại vòng mặc định')]
  const lines: string[] = []
  for (const item of rings) {
    const ring = asRecord(item)
    if (ring && Array.isArray(ring.points)) lines.push(describeOneRing(ring, ring.points))
  }
  return lines
}

// Đếm phần tử của một danh sách trong lịch đếm (hồ sơ theo mùa, khung tạm); không phải danh sách thì 0
function countItems(schedule: unknown, key: 'profiles' | 'temporary'): number {
  const items = asRecord(schedule)?.[key]
  return Array.isArray(items) ? items.length : 0
}

// Lịch đếm là cấu trúc lồng nhau nên chỉ tóm tắt số hồ sơ theo mùa và khung tạm trước / sau (VISION-FR-019)
function describeCountingSchedule(before: unknown, after: unknown): string[] {
  return [
    t('Hồ sơ theo mùa: {before} → {after}', { before: countItems(before, 'profiles'), after: countItems(after, 'profiles') }),
    t('Khung tạm: {before} → {after}', { before: countItems(before, 'temporary'), after: countItems(after, 'temporary') }),
  ]
}

// Chi tiết một mục chờ chuyên gia duyệt (EXPERT-FR-010): đọc được cho cả 7 nhóm tham số (BR-22)
export function describeReviewChanges(review: Pick<ParameterReview, 'group' | 'old_values' | 'new_values'>): string[] {
  if (review.group === 'counting_ring') {
    // Mục mới ghi new_values.rings (nhiều vòng), mục cũ ghi new_values.ring (một vòng)
    const newValues = asRecord(review.new_values)
    return describeCountingRing(newValues?.rings ?? newValues?.ring)
  }
  if (review.group === 'counting_schedule') return describeCountingSchedule(review.old_values, review.new_values)
  return describeValueChanges(review.old_values, review.new_values)
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

// Số dòng chi tiết hiện trong danh sách; phần còn lại xem ở bảng chi tiết khi bấm vào dòng
export const PREVIEW_DETAIL_LINES = 2

// Danh sách chỉ hiện vài dòng đầu và thêm dòng "+N dòng khác" để mỗi hàng gọn; đủ hết ở bảng chi tiết
export function getDetailPreview(lines: string[], maxLines: number = PREVIEW_DETAIL_LINES): string[] {
  if (lines.length <= maxLines) return lines
  return [...lines.slice(0, maxLines), t('+{count} dòng khác', { count: lines.length - maxLines })]
}

// Nội dung bảng chi tiết của một dòng ở màn Hoạt động chuyên gia: tiêu đề, trạng thái, các thông tin (tên – giá trị) và
// toàn bộ dòng thay đổi, ghi chú
export interface ActivityDetail {
  title: string
  status?: string
  facts: { label: string; value: string }[]
  lines: string[]
}

// Các dòng của một quyết định: kết luận cảnh báo (nếu có) rồi các thay đổi, ghi chú
export function getDecisionLines(entry: Pick<ExpertActivityEntry, 'action' | 'metadata'>): string[] {
  const verdict = getActivityVerdict(entry.metadata)
  const lines = describeActivityChanges(entry)
  if (verdict === 'CONFIRMED') return [t('Kết luận: cảnh báo đúng'), ...lines]
  if (verdict === 'REJECTED') return [t('Kết luận: bác bỏ cảnh báo'), ...lines]
  return lines
}

// Người làm một quyết định kèm vai trò, ví dụ "Trần An (Chuyên gia)"
export function getDecisionActorText(entry: Pick<ExpertActivityEntry, 'actor' | 'actor_role'>): string {
  return `${entry.actor?.full_name ?? '_'} (${getRoleLabel(entry.actor_role)})`
}

// Bảng chi tiết một quyết định trong lịch sử (EXPERT-FR-009); scopeText là "nhà › Zone" màn đã tra sẵn
export function buildDecisionDetail(
  entry: Pick<ExpertActivityEntry, 'action' | 'metadata' | 'actor' | 'actor_role' | 'created_at'>,
  scopeText: string,
): ActivityDetail {
  return {
    title: getExpertActionLabel(entry.action),
    facts: [
      { label: t('Người làm'), value: getDecisionActorText(entry) },
      { label: t('Lúc'), value: formatDateTime(entry.created_at) },
      { label: t('Nơi'), value: scopeText || '_' },
    ],
    lines: getDecisionLines(entry),
  }
}

// Bảng chi tiết một thay đổi của chủ trại chờ chuyên gia duyệt (EXPERT-FR-010); chỉ chuyên gia xử lý mục này (BR-22)
export function buildReviewDetail(
  review: Pick<ParameterReview, 'group' | 'status' | 'old_values' | 'new_values' | 'created_at' | 'reviewed_at'>,
  scopeText: string,
): ActivityDetail {
  const facts = [
    { label: t('Nơi'), value: scopeText || '_' },
    { label: t('Bạn sửa lúc'), value: formatDateTime(review.created_at) },
  ]
  if (review.reviewed_at) facts.push({ label: t('Chuyên gia xử lý lúc'), value: formatDateTime(review.reviewed_at) })
  return {
    title: getParameterReviewGroupLabel(review.group),
    status: getReviewStatusLabel(review.status),
    facts,
    lines: describeReviewChanges(review),
  }
}

// Các dòng của một gợi ý hệ số đã gửi: hệ số đang dùng → gợi ý, rồi lý do từ chối nếu có
export function getProposalLines(proposal: Pick<CoefficientProposal, 'current_values' | 'suggested_values' | 'note'>): string[] {
  const lines = describeValueDiff(proposal.current_values, proposal.suggested_values)
  if (!proposal.note) return lines
  return [...lines, t('Lý do: {note}', { note: proposal.note })]
}

// Bảng chi tiết một gợi ý hệ số chủ trại đã gửi chuyên gia (EXPERT-FR-011)
export function buildProposalDetail(
  proposal: Pick<CoefficientProposal, 'status' | 'current_values' | 'suggested_values' | 'note' | 'created_at' | 'decided_at'>,
  scopeText: string,
): ActivityDetail {
  const facts = [
    { label: t('Nơi'), value: scopeText || '_' },
    { label: t('Gửi lúc'), value: formatDateTime(proposal.created_at) },
  ]
  if (proposal.decided_at) facts.push({ label: t('Chuyên gia quyết định lúc'), value: formatDateTime(proposal.decided_at) })
  return {
    title: t('Gợi ý hệ số'),
    status: getReviewStatusLabel(proposal.status),
    facts,
    lines: getProposalLines(proposal),
  }
}
