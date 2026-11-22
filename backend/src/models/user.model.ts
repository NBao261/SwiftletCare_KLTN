import { Schema, model, Document, Types } from 'mongoose'
import bcrypt from 'bcryptjs'
import type { Role, NotificationPreferences } from '@/types'

export const USER_STATUSES = ['ACTIVE', 'LOCKED', 'DELETION_REQUESTED', 'DELETED'] as const
export type UserStatus = typeof USER_STATUSES[number]
/** AUTH-FR-012: vẫn đăng nhập được để huỷ yêu cầu */
export const SIGN_IN_STATUSES: UserStatus[] = ['ACTIVE', 'DELETION_REQUESTED']
export const canSignIn = (user: { status?: UserStatus }): boolean => SIGN_IN_STATUSES.includes(user.status ?? 'ACTIVE')
/** Loại thay vì nhận: tài khoản chưa có status (trước migrate:erd-fields) vẫn hợp lệ */
export const SIGN_IN_FILTER = { status: { $nin: ['LOCKED', 'DELETED'] as UserStatus[] } }

export interface IUser extends Document {
  _id: Types.ObjectId
  email: string
  phone?: string
  password_hash: string
  full_name: string
  role: Role
  avatar_url?: string
  status: UserStatus
  /** AUTH-FR-005c: authenticate chặn mọi route khác tới khi đổi */
  must_change_password?: boolean
  /** Bắt buộc có lý do */
  locked_at?: Date
  locked_reason?: string
  notification_preferences: NotificationPreferences
  telegram_chat_id?: string
  /** 10 phút */
  telegram_link_code_hash?: string
  telegram_link_expires_at?: Date
  /** Lưu hash: lộ DB cũng không đặt lại được mật khẩu */
  password_reset_token_hash?: string
  password_reset_expires_at?: Date
  deletion_requested_at?: Date
  /** Nhắc đúng 1 lần */
  deletion_reminder_sent_at?: Date
  /** Document giữ lại để không vỡ tham chiếu */
  deleted_at?: Date
  /** Lưu hash: lộ DB cũng không lấy được access token */
  refresh_tokens: Array<{ token_hash: string; expires: Date }>
  created_at: Date
  updated_at: Date
  comparePassword(plain: string): Promise<boolean>
}

const channelChoiceSchema = new Schema({ push: Boolean, telegram: Boolean }, { _id: false })

const userSchema = new Schema<IUser>(
  {
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:         { type: String, trim: true },
    password_hash: { type: String, required: true },
    full_name:     { type: String, required: true, trim: true },
    role:          { type: String, enum: ['ADMIN', 'FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'] satisfies Role[], default: 'FARM_OWNER' },
    avatar_url:    { type: String },
    status:        { type: String, enum: USER_STATUSES, default: 'ACTIVE' },
    must_change_password: { type: Boolean, default: false },
    locked_at:     { type: Date },
    locked_reason: { type: String },
    notification_preferences: {
      push:  { type: Boolean, default: true },
      telegram: { type: Boolean, default: true },
      by_severity: {
        CRITICAL: { type: channelChoiceSchema, default: undefined },
        HIGH:     { type: channelChoiceSchema, default: undefined },
        MEDIUM:   { type: channelChoiceSchema, default: undefined },
        LOW:      { type: channelChoiceSchema, default: undefined },
      },
      quiet_hours: {
        start: { type: String, default: '22:00' },
        end:   { type: String, default: '06:00' },
      },
    },
    telegram_chat_id: { type: String },
    // Index: bot công khai, mỗi /start không được quét cả bảng
    telegram_link_code_hash:  { type: String, select: false, index: true, sparse: true },
    telegram_link_expires_at: { type: Date, select: false },
    // .lean() bỏ qua toJSON nên phải select: false
    password_reset_token_hash: { type: String, select: false },
    password_reset_expires_at: { type: Date, select: false },
    deletion_requested_at:     { type: Date },
    deletion_reminder_sent_at: { type: Date },
    deleted_at:                { type: Date },
    refresh_tokens: [{ token_hash: String, expires: Date }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

// SEC-NFR-003: bcrypt cost=12
userSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next()
  this.password_hash = await bcrypt.hash(this.password_hash, 12)
  next()
})

userSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.password_hash) as Promise<boolean>
}

userSchema.methods.toJSON = function () {
  const obj = this.toObject() as Partial<IUser> & Record<string, unknown>
  delete obj.password_hash
  delete obj.refresh_tokens
  // Mã 6 số hash không salt dò được dưới 1 giây: lộ hash là lộ mã
  delete obj.password_reset_token_hash
  delete obj.password_reset_expires_at
  obj.telegram_linked = !!obj.telegram_chat_id
  delete obj.telegram_chat_id
  delete obj.telegram_link_code_hash
  delete obj.telegram_link_expires_at
  // Chỉ suy ra, không lưu
  obj.is_active = canSignIn(this as IUser)
  obj.deactivated_at = obj.locked_at
  obj.deactivated_reason = obj.locked_reason
  return obj
}

userSchema.index({ status: 1 })

export const User = model<IUser>('User', userSchema)
