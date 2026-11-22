import { Schema, model, Document, Types } from 'mongoose'

export type NotificationRefKind = 'alert' | 'health_report' | 'health_day' | 'expert_decision' | 'parameter_review' | 'coefficient_proposal' | 'work_order' | 'device_action'
  // BR-22
  | 'weather_rules' | 'config_profile' | 'recommendation_rule' | 'harvest_cycle'

/** EXPERT-FR-006/007: lưu để người offline vẫn thấy; realtime qua socket */
export interface INotification extends Document {
  _id: Types.ObjectId
  user_id: Types.ObjectId
  title: string
  body: string
  ref?: { kind: NotificationRefKind; id: Types.ObjectId }
  read_at?: Date
  created_at: Date
}

/** ponytail: 90 ngày chọn tay cho khớp telemetry, không có nguồn */
export const NOTIFICATION_TTL_SECONDS = 90 * 24 * 60 * 60

const notificationSchema = new Schema<INotification>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title:   { type: String, required: true },
    body:    { type: String, required: true },
    ref: {
      type: {
        kind: { type: String, enum: ['alert', 'health_report', 'health_day', 'expert_decision', 'parameter_review', 'coefficient_proposal', 'work_order', 'device_action', 'weather_rules', 'config_profile', 'recommendation_rule', 'harvest_cycle'] satisfies NotificationRefKind[], required: true },
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
