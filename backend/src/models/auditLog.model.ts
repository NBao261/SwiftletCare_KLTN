import { Schema, model, Document, Types } from 'mongoose'

/** AuditLog – SRS §8.2, AUTH-FR-007 — nhật ký hành động quản trị/đăng nhập */
export interface IAuditLog extends Document {
  _id: Types.ObjectId
  actor_id?: Types.ObjectId // ref User, rỗng nếu hệ thống tự ghi (ví dụ job nền)
  action: string            // ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, ACCOUNT_DELETED, TICKET_ADMIN_OVERRIDE, ...
  target_type: string       // 'user' | 'ticket' | 'farm' | ...
  target_id?: Types.ObjectId
  metadata?: Record<string, unknown>
  ip_address?: string
  created_at: Date
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor_id:    { type: Schema.Types.ObjectId, ref: 'User' },
    action:      { type: String, required: true },
    target_type: { type: String, required: true },
    target_id:   { type: Schema.Types.ObjectId },
    metadata:    { type: Schema.Types.Mixed },
    ip_address:  { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
)

auditLogSchema.index({ target_type: 1, target_id: 1 })
auditLogSchema.index({ actor_id: 1, created_at: -1 })

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema)
