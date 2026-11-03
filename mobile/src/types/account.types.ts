import type { AlertType } from './alert.types'
import type { Role } from './auth.types'

// Lời mời thành viên farm — khớp schema Invitation của api-spec (AUTH-FR-010, Report 3 §6.4)
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
export type InvitedRole = Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT'>

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

// Các loại quyết định của chuyên gia mà Farm Owner được báo (EXPERT-FR-009). Backend chưa có lịch sử hoạt động chuyên gia:
// tên giá trị là tạm, đổi theo api-spec khi route có
export type ExpertDecisionType =
  | 'THRESHOLDS'
  | 'THRESHOLDS_RESET'
  | 'FUZZY_TUNING'
  | 'DETECTION_TUNING'
  | 'RETURN_RATE_DROP'
  | 'COUNTING_RING'
  | 'COUNTING_SCHEDULE'
  | 'ALERT_VERDICT'
  | 'CONCLUSION'
  | 'CHANGE_REVIEW'
  | 'SUGGESTION_APPROVAL'

export interface ExpertDecision {
  _id: string
  type: ExpertDecisionType
  actor_name: string
  // Farm chưa có chuyên gia thì Farm Owner quyết thay, lưu kèm vai trò (BR-22)
  actor_role: Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT'>
  created_at: string
  house_name?: string
  zone_name?: string
  // Giá trị cũ và mới đã định dạng sẵn, hoặc phán quyết
  old_value?: string
  new_value?: string
  verdict?: 'CONFIRMED' | 'REJECTED'
  note?: string
}

// Mục chờ chuyên gia duyệt khi Farm Owner tự sửa ngưỡng, hệ số (EXPERT-FR-010, §6.10) hoặc gửi gợi ý hệ số (EXPERT-FR-011, §6.11)
export type ChangeReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REVERTED' | 'ADJUSTED'
export type ProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'

export interface ReviewItem {
  _id: string
  kind: 'CHANGE_REVIEW' | 'SUGGESTION_PROPOSAL'
  group: 'THRESHOLDS' | 'FUZZY_TUNING'
  status: ChangeReviewStatus | ProposalStatus
  house_name: string
  zone_name: string
  old_value: string
  new_value: string
  created_at: string
  resolved_at?: string
  note?: string
}

// Kênh nhận cho từng loại sự kiện (ALERT-FR-005). Tắt một kênh thì loại đó không gửi qua kênh ấy, cảnh báo vẫn có trong app
export interface NotificationChannelSetting {
  in_app: boolean
  push: boolean
  telegram: boolean
}

export type NotificationChannelPreferences = Partial<Record<AlertType, NotificationChannelSetting>>
