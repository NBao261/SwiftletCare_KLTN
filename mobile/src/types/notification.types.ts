// Thông báo trong ứng dụng (EXPERT-FR-006/007) — khớp schema Notification trong docs/api/api-spec.yaml
export interface NotificationRef {
  // Đối tượng để mở tới khi bấm thông báo — khớp enum Notification.ref.kind trong api-spec. expert_decision: id là mục trong
  // lịch sử hoạt động chuyên gia (EXPERT-FR-009); parameter_review, coefficient_proposal chỉ gửi cho chuyên gia; health_day: ngày
  // đánh giá mới của nhà, mở health/[dayId] (BR-31); work_order: Work Order được giao, cần duyệt,
  // bị mở lại (OPS-FR-001…004); alert cũng dùng cho yêu cầu kiểm tra tại chỗ (EXPERT-FR-021)
  kind:
    | 'alert'
    | 'health_report'
    | 'health_day'
    | 'expert_decision'
    | 'parameter_review'
    | 'coefficient_proposal'
    | 'work_order'
    | 'device_action'
    // BR-22 (Report 3 4.2.15): đề xuất luật thời tiết, hồ sơ, luật khuyến nghị chờ duyệt; lời nhắc kết luận mùa vụ
    | 'weather_rules'
    | 'config_profile'
    | 'recommendation_rule'
    | 'harvest_cycle'
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
