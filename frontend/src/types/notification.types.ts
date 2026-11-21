// EXPERT-FR-007 — thông báo trong ứng dụng (api-spec `Notification`), khác cảnh báo vận hành (`Alert`)
export type NotificationRefKind =
  | 'alert' | 'health_report' | 'health_day' | 'expert_decision'
  | 'parameter_review' | 'coefficient_proposal' | 'work_order' | 'device_action'
  // BR-22 — việc Farm Owner gửi chuyên gia duyệt; nhắc việc mùa vụ
  | 'weather_rules' | 'config_profile' | 'recommendation_rule' | 'harvest_cycle'

export interface AppNotification {
  _id: string
  title: string
  body: string
  ref?: { kind: NotificationRefKind; id: string } | null
  read_at?: string | null
  created_at: string
}
