// Thông báo trong ứng dụng (EXPERT-FR-006/007) — khớp schema Notification trong docs/api/api-spec.yaml
export interface NotificationRef {
  // Đối tượng để mở tới khi bấm thông báo
  kind: 'alert' | 'health_report'
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
