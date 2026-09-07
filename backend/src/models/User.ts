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
  avatar_url?: string
  is_active: boolean
  notification_preferences: NotificationPreferences
  otp_code?: string
  otp_expires?: Date
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
    role:          { type: String, enum: ['ADMIN', 'FARM_OWNER', 'OPERATOR'] satisfies Role[], default: 'FARM_OWNER' },
    avatar_url:    { type: String },
    is_active:     { type: Boolean, default: true },
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
