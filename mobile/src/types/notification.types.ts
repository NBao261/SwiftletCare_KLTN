// Thông báo trong ứng dụng (EXPERT-FR-006/007) — khớp schema Notification trong docs/api/api-spec.yaml
export interface NotificationRef {
  // Đối tượng để mở tới khi bấm thông báo — khớp enum Notification.ref.kind trong api-spec. expert_decision: id là mục trong
  // lịch sử hoạt động chuyên gia (EXPERT-FR-009); parameter_review, coefficient_proposal chỉ gửi cho chuyên gia
  kind: 'alert' | 'health_report' | 'expert_decision' | 'parameter_review' | 'coefficient_proposal'
  id: string
}

export interface InAppNotification {
  _id: string
  title: string
  body: string
  ref: NotificationRef | null
  // null = chưa đọc
  read_at: string | null
  created_at: string
}
