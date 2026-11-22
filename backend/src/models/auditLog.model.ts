import { Schema, model, Document, Types } from 'mongoose'
import type { Role } from '@/types'

export interface IAuditLog extends Document {
  _id: Types.ObjectId
  actor_id?: Types.ObjectId
  actor_role?: Role | 'TECHNICIAN'
  farm_id?: Types.ObjectId
  action: string
  target_type: string
  target_id?: Types.ObjectId
  metadata?: Record<string, unknown>
  before?: unknown
  after?: unknown
  source_ip?: string
  client?: string
  correlation_id?: string
  created_at: Date
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor_id:    { type: Schema.Types.ObjectId, ref: 'User' },
    // TECHNICIAN chỉ còn ở các dòng ghi cũ: lịch sử không sửa
    actor_role:  { type: String, enum: [...(['ADMIN', 'FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'] satisfies Role[]), 'TECHNICIAN'] },
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm' },
    action:      { type: String, required: true },
    target_type: { type: String, required: true },
    target_id:   { type: Schema.Types.ObjectId },
    metadata:    { type: Schema.Types.Mixed },
    before:      { type: Schema.Types.Mixed },
    after:       { type: Schema.Types.Mixed },
    source_ip:   { type: String },
    client:      { type: String },
    correlation_id: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
)

auditLogSchema.index({ target_type: 1, target_id: 1 })
auditLogSchema.index({ actor_id: 1, created_at: -1 })
auditLogSchema.index({ created_at: -1 })
auditLogSchema.index({ action: 1, created_at: -1 })
auditLogSchema.index({ farm_id: 1, created_at: -1 })

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema)
