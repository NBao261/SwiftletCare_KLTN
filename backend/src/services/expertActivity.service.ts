import { AuditLog } from '@/models/auditLog.model'
import { User } from '@/models/user.model'
import { createInAppNotification, findRecipients } from '@/services/notification.service'
import { assertFarmAccess } from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

/**
 * EXPERT-FR-009 — các quyết định của Domain Expert trên 1 farm, theo tên hành động trong audit log:
 * tham số, kết luận, và kết quả mục duyệt / đề xuất hệ số (EXPERT-FR-010/011). Lịch đếm (VISION-FR-019,
 * G-12) thêm vào đây khi gap đó làm.
 */
export const EXPERT_DECISION_ACTIONS = [
  'THRESHOLD_UPDATED', 'FUZZY_TUNING_UPDATED', 'DETECTION_TUNING_UPDATED', 'BIRD_COUNT_TUNING_UPDATED',
  'COUNTING_RING_UPDATED', 'ALERT_VERDICT_SET', 'HEALTH_REPORT_CONCLUDED',
  'REVIEW_ACCEPTED', 'REVIEW_REVERTED', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED',
] as const
export type ExpertDecisionAction = typeof EXPERT_DECISION_ACTIONS[number]

/**
 * BR-22 — quyết định Farm Owner làm thay khi farm chưa có chuyên gia; lịch sử liệt kê cả khi
 * Farm Owner làm (role FARM_OWNER). Ngưỡng và hệ số mờ Farm Owner luôn sửa được nên không thuộc nhóm này.
 */
export const BR22_ACTIONS: ExpertDecisionAction[] = [
  'DETECTION_TUNING_UPDATED', 'BIRD_COUNT_TUNING_UPDATED', 'COUNTING_RING_UPDATED', 'ALERT_VERDICT_SET',
]

const VN_TIME = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })

/** "humidity_min 75 → 80, temp_max 32 → 33" — chỉ các khoá đổi giá trị; rỗng khi không có khoá nào đổi */
export function formatChanges(before: object = {}, after: object = {}): string {
  const b = before as Record<string, unknown>
  const a = after as Record<string, unknown>
  return Object.keys(a)
    .filter(key => JSON.stringify(b[key]) !== JSON.stringify(a[key]))
    .map(key => `${key} ${JSON.stringify(b[key] ?? null)} → ${JSON.stringify(a[key])}`)
    .join(', ')
}

/**
 * EXPERT-FR-009 — mỗi quyết định của Domain Expert tạo 1 thông báo trong ứng dụng cho mọi Farm Owner
 * của farm: ai, lúc nào, ở đâu, cũ → mới (hoặc kết quả). Quyết định do Farm Owner làm thay (BR-22) không
 * báo cho chính họ. Không throw: thông báo hỏng không được làm hỏng quyết định đã lưu.
 */
export async function notifyExpertDecision(
  user: CurrentUser, farmId: unknown, auditId: string | undefined,
  message: { what: string; place: string; detail?: string },
): Promise<void> {
  if (user.role !== 'DOMAIN_EXPERT') return
  try {
    const [owners, expert] = await Promise.all([
      findRecipients(String(farmId)), User.findById(user._id).select('full_name').lean(),
    ])
    const title = `Chuyên gia ${expert?.full_name ?? user.email} đã ${message.what}`
    const body = [`${message.place} — ${VN_TIME.format(new Date())}`, message.detail].filter(Boolean).join('. ')
    await Promise.all(owners.map(owner => createInAppNotification(String(owner._id), {
      title, body, ...(auditId && { ref: { kind: 'expert_decision' as const, id: auditId } }),
    })))
  } catch (err) {
    logger.warn('Báo Farm Owner về quyết định của chuyên gia thất bại', { err, farmId: String(farmId), what: message.what })
  }
}

export interface ExpertActivityQuery {
  farmId: string
  from?: string
  to?: string
  type?: ExpertDecisionAction
  zoneId?: string
  houseId?: string
  page?: string | number
  limit?: string | number
}

/**
 * EXPERT-FR-009 — lịch sử hoạt động chuyên gia của 1 farm, đọc từ audit log (Report 4 §6.1).
 * Chỉ Farm Owner và Domain Expert của farm (Technician, Administrator không phải thành viên → 403).
 */
export async function listExpertActivity(user: CurrentUser, query: ExpertActivityQuery) {
  const farm = await assertFarmAccess(query.farmId, user)
  const expertActions = query.type ? [query.type] : [...EXPERT_DECISION_ACTIONS]
  const ownerActions = expertActions.filter(a => BR22_ACTIONS.includes(a))

  const filter: Record<string, unknown> = {
    farm_id: farm._id,
    // Đổi Zone do duyệt mục / đề xuất đã có dòng REVIEW_* / PROPOSAL_* riêng: 1 quyết định 1 dòng
    'metadata.decided_in': { $exists: false },
    $or: [
      { actor_role: 'DOMAIN_EXPERT', action: { $in: expertActions } },
      { actor_role: 'FARM_OWNER', action: { $in: ownerActions } },
    ],
  }
  if (query.from || query.to) {
    filter.created_at = { ...(query.from && { $gte: new Date(query.from) }), ...(query.to && { $lte: new Date(query.to) }) }
  }
  if (query.zoneId) filter['metadata.zone_id'] = query.zoneId
  if (query.houseId) filter['metadata.house_id'] = query.houseId

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit)
      .populate<{ actor_id: { _id: unknown; full_name: string } | null }>('actor_id', 'full_name').lean(),
    AuditLog.countDocuments(filter),
  ])

  const records = rows.map(row => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    return {
      _id: String(row._id),
      action: row.action,
      actor: row.actor_id ? { _id: String(row.actor_id._id), full_name: row.actor_id.full_name } : null,
      actor_role: row.actor_role,
      target_type: row.target_type,
      target_id: row.target_id ? String(row.target_id) : undefined,
      zone_id: metadata.zone_id ?? null,
      house_id: metadata.house_id ?? null,
      metadata,
      created_at: row.created_at,
    }
  })
  return { records, total, page, limit }
}
