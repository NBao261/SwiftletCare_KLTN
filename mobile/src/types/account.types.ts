import type { Role } from './auth.types'

// Lời mời thành viên farm — khớp schema Invitation của api-spec (AUTH-FR-010, Report 3 §6.4)
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
export type InvitedRole = Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'FARM_TECHNICIAN'>

export interface Invitation {
  _id: string
  farm_id: string
  invited_email: string
  invited_role: InvitedRole
  invited_by: string
  status: InvitationStatus
  expires_at: string
  responded_at?: string
  created_at: string
}

// Body của POST /farms/{id}/members
export interface InviteMemberPayload {
  email: string
  role: InvitedRole
}

// Một quyết định trong lịch sử hoạt động của farm (EXPERT-FR-009, api-spec ExpertActivityEntry, GET /expert-activity).
// action là mã audit của backend (THRESHOLD_UPDATED, ALERT_VERDICT_SET…); Farm Owner làm thay khi farm chưa có chuyên
// gia (BR-22) thì actor_role = FARM_OWNER
export interface ExpertActivityEntry {
  _id: string
  action: string
  actor: { _id: string; full_name?: string } | null
  actor_role: Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT'>
  target_type: string
  target_id: string
  zone_id?: string | null
  house_id?: string | null
  // Giá trị cũ/mới (before, after) hoặc kết quả kiểm chứng (result) — hình dạng tuỳ action
  metadata?: Record<string, unknown>
  created_at: string
}

// Mục duyệt thay đổi của Farm Owner trên farm có chuyên gia (EXPERT-FR-010, api-spec ParameterReview)
export type ChangeReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REVERTED' | 'ADJUSTED'

// Nhóm tham số của mục duyệt (BR-22, Report 3 4.2.15): theo Zone (thresholds, fuzzy, detection), theo nhà (return_rate_drop,
// health_levels, counting_schedule), theo camera (counting_ring) — khớp PARAMETER_GROUPS của backend
export type ParameterReviewGroup =
  | 'thresholds'
  | 'fuzzy'
  | 'detection'
  | 'return_rate_drop'
  | 'health_levels'
  | 'counting_schedule'
  | 'counting_ring'

export interface ParameterReview {
  _id: string
  // Zone, nhà hoặc camera của thay đổi
  target_id?: string
  // Chỉ có ở nhóm theo Zone
  zone_id?: string
  // Nhà của đối tượng (mục cũ trước Report 3 4.2.15 có thể thiếu, khi đó tìm nhà qua Zone)
  house_id?: string
  // Chỉ có ở nhóm counting_ring
  camera_node_id?: string
  farm_id: string
  group: ParameterReviewGroup
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  status: ChangeReviewStatus
  changed_by: string
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at: string
  updated_at: string
}

// Gợi ý hệ số Farm Owner gửi chuyên gia (EXPERT-FR-011, api-spec CoefficientProposal)
export type ProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'

export interface CoefficientProposal {
  _id: string
  zone_id: string
  farm_id: string
  submitted_by: string | { _id: string; full_name?: string }
  suggested_values: Record<string, number | unknown>
  current_values: Record<string, number | unknown>
  predicted?: {
    inRangeNow?: number
    inRangeSuggested?: number
    mistingNow?: number
    mistingSuggested?: number
    in_range_pct?: number
  }
  r_squared?: number
  predicted_in_range_pct?: number
  status: ProposalStatus
  // Lý do từ chối
  note?: string | null
  decided_by?: string | null
  decided_at?: string | null
  created_at: string
}

// Việc Farm Owner nhắc chuyên gia được (POST /expert-activity/reminders, BR-22 nhóm C): kết luận cảnh báo suy luận, báo cáo sức
// khoẻ, mùa vụ đã đóng
export type ExpertReminderKind = 'alert' | 'health_report' | 'harvest_cycle'

export interface ExpertReminder {
  kind: ExpertReminderKind
  id: string
  expert_reminded_at: string
}
