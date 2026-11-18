import { Schema, model, Document, Types } from 'mongoose'
import type { Role } from '@/types'

/** AuditLog – SRS §8.2, AUTH-FR-007 — nhật ký hành động quản trị/đăng nhập */
export interface IAuditLog extends Document {
  _id: Types.ObjectId
  actor_id?: Types.ObjectId // ref User, rỗng nếu hệ thống tự ghi (ví dụ job nền)
  /** Vai trò người làm lúc ghi (EXPERT-FR-009); rỗng khi hệ thống tự ghi ngoài request */
  actor_role?: Role | 'TECHNICIAN'
  /** Farm của hành động — nguồn của lịch sử hoạt động chuyên gia (EXPERT-FR-009, Report 4 §6.1) */
  farm_id?: Types.ObjectId
  action: string            // ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, ACCOUNT_DELETED, DEVICE_COMMAND_SENT, ...
  target_type: string       // 'user' | 'farm' | 'sensor_node' | ...
  target_id?: Types.ObjectId
  metadata?: Record<string, unknown>
  /** Report 4 §6.1 — giá trị trước và sau của thay đổi, chép từ `metadata.before`/`after` khi có */
  before?: unknown
  after?: unknown
  /** IP client (trước G-14 tên là `ip_address`, `npm run migrate:erd-fields`) */
  source_ip?: string
  /** User-Agent của web/mobile */
  client?: string
  /** Mã request: các dòng audit của cùng một thao tác có cùng mã */
  correlation_id?: string
  created_at: Date
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor_id:    { type: Schema.Types.ObjectId, ref: 'User' },
    // `TECHNICIAN` chỉ còn ở dòng audit ghi trước G-20 (role cũ): lịch sử không sửa
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
// SYSTEM-FR-001 luôn sort created_at:-1 và lọc theo khoảng thời gian / loại hành động
auditLogSchema.index({ created_at: -1 })
auditLogSchema.index({ action: 1, created_at: -1 })
// EXPERT-FR-009 — lịch sử hoạt động của 1 farm, mới nhất trước
auditLogSchema.index({ farm_id: 1, created_at: -1 })

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema)
