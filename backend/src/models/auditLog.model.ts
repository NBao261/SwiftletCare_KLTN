import { Schema, model, Document, Types } from 'mongoose'
import type { Role } from '@/types'

/** AuditLog – SRS §8.2, AUTH-FR-007 — nhật ký hành động quản trị/đăng nhập */
export interface IAuditLog extends Document {
  _id: Types.ObjectId
  actor_id?: Types.ObjectId // ref User, rỗng nếu hệ thống tự ghi (ví dụ job nền)
  /** Vai trò người làm lúc ghi (EXPERT-FR-009); rỗng khi hệ thống tự ghi ngoài request */
  actor_role?: Role
  /** Farm của hành động — nguồn của lịch sử hoạt động chuyên gia (EXPERT-FR-009, Report 4 §6.1) */
  farm_id?: Types.ObjectId
  action: string            // ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, ACCOUNT_DELETED, DEVICE_COMMAND_SENT, ...
  target_type: string       // 'user' | 'farm' | 'sensor_node' | ...
  target_id?: Types.ObjectId
  metadata?: Record<string, unknown>
  ip_address?: string
  created_at: Date
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor_id:    { type: Schema.Types.ObjectId, ref: 'User' },
    actor_role:  { type: String, enum: ['ADMIN', 'FARM_OWNER', 'DOMAIN_EXPERT', 'TECHNICIAN'] satisfies Role[] },
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm' },
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
// SYSTEM-FR-001 luôn sort created_at:-1 và lọc theo khoảng thời gian / loại hành động
auditLogSchema.index({ created_at: -1 })
auditLogSchema.index({ action: 1, created_at: -1 })
// EXPERT-FR-009 — lịch sử hoạt động của 1 farm, mới nhất trước
auditLogSchema.index({ farm_id: 1, created_at: -1 })

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema)
