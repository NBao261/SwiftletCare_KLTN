import { Schema, model, Document, Types } from 'mongoose'

export type NotificationRefKind = 'alert' | 'health_report' | 'expert_decision' | 'parameter_review' | 'coefficient_proposal'

/**
 * Hộp thông báo trong ứng dụng (EXPERT-FR-006/007, SRS §3.2 "thông báo trong ứng dụng").
 * Lưu lại để người đang offline vẫn thấy khi mở app; bản realtime đi qua socket `NOTIFICATION_NEW`.
 */
export interface INotification extends Document {
  _id: Types.ObjectId
  user_id: Types.ObjectId
  title: string
  body: string
  /** Đối tượng để client mở tới (cảnh báo chờ kiểm chứng, báo cáo sức khỏe) */
  ref?: { kind: NotificationRefKind; id: Types.ObjectId }
  read_at?: Date
  created_at: Date
}

/** ponytail: 90 ngày chọn tay cho khớp telemetry, không có nguồn — SRS §0.5 bảng giả định */
export const NOTIFICATION_TTL_SECONDS = 90 * 24 * 60 * 60

const notificationSchema = new Schema<INotification>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title:   { type: String, required: true },
    body:    { type: String, required: true },
    ref: {
      type: {
        kind: { type: String, enum: ['alert', 'health_report', 'expert_decision', 'parameter_review', 'coefficient_proposal'] satisfies NotificationRefKind[], required: true },
        id:   { type: Schema.Types.ObjectId, required: true },
        _id: false,
      },
    },
    read_at:    { type: Date },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
)

notificationSchema.index({ user_id: 1, created_at: -1 })
notificationSchema.index({ created_at: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_SECONDS })

export const Notification = model<INotification>('Notification', notificationSchema)
