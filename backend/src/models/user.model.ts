import { Schema, model, Document, Types } from 'mongoose'
import bcrypt from 'bcryptjs'
import type { Role, NotificationPreferences } from '@/types'

/**
 * User Document – SRS §8.2
 * AUTH-FR-001, AUTH-FR-004, SEC-NFR-003
 */
export interface IUser extends Document {
  _id: Types.ObjectId
  email: string
  phone?: string
  password_hash: string
  full_name: string
  role: Role
  assigned_regions?: string[] // chỉ dùng khi role=TECHNICIAN (AUTH-FR-005c)
  avatar_url?: string
  is_active: boolean
  /** AUTH-FR-011 — bắt buộc có lý do khi Admin khoá tài khoản, ghi cùng lúc với is_active=false (Flow 19) */
  deactivated_at?: Date
  deactivated_reason?: string
  notification_preferences: NotificationPreferences
  otp_code?: string
  otp_expires?: Date
  /** AUTH-FR-009 — lưu hash chứ không phải OTP thô, để lộ DB cũng không đặt lại được mật khẩu người khác */
  password_reset_token_hash?: string
  password_reset_expires_at?: Date
  /** AUTH-FR-012 — user tự yêu cầu xoá, Admin xử lý trong ≤30 ngày (PRIV-NFR-003) */
  deletion_requested_at?: Date
  refresh_tokens: Array<{ token: string; expires: Date }>
  created_at: Date
  updated_at: Date
  // Methods
  comparePassword(plain: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:         { type: String, trim: true },
    password_hash: { type: String, required: true },
    full_name:     { type: String, required: true, trim: true },
    role:          { type: String, enum: ['ADMIN', 'FARM_OWNER', 'TECHNICIAN', 'SALES_STAFF'] satisfies Role[], default: 'FARM_OWNER' },
    assigned_regions: [{ type: String }],
    avatar_url:    { type: String },
    is_active:     { type: Boolean, default: true },
    deactivated_at:     { type: Date },
    deactivated_reason: { type: String },
    notification_preferences: {
      push:  { type: Boolean, default: true },
      zalo:  { type: Boolean, default: true },
      sms:   { type: Boolean, default: false },
      quiet_hours: {
        start: { type: String, default: '22:00' },
        end:   { type: String, default: '06:00' },
      },
    },
    otp_code:      { type: String },
    otp_expires:   { type: Date },
    password_reset_token_hash: { type: String },
    password_reset_expires_at: { type: Date },
    deletion_requested_at:     { type: Date },
    refresh_tokens: [{ token: String, expires: Date }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

// Hash password before save (SEC-NFR-003: bcrypt cost=12)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next()
  this.password_hash = await bcrypt.hash(this.password_hash, 12)
  next()
})

userSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.password_hash) as Promise<boolean>
}

// Never return sensitive fields in JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject() as Partial<IUser> & Record<string, unknown>
  delete obj.password_hash
  delete obj.otp_code
  delete obj.otp_expires
  delete obj.refresh_tokens
  return obj
}

export const User = model<IUser>('User', userSchema)
