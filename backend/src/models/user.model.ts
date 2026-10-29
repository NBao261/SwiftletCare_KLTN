import { Schema, model, Document, Types } from 'mongoose'
import bcrypt from 'bcryptjs'
import type { Role, NotificationPreferences } from '@/types'

/**
 * User Document – SRS §8.2
 * AUTH-FR-002, AUTH-FR-004, AUTH-FR-005c, SEC-NFR-003
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
  /**
   * AUTH-FR-005c — mật khẩu do Admin đặt (tạo Technician / đặt lại mật khẩu) là mật khẩu
   * tạm: người dùng phải tự đổi trước khi dùng hệ thống (`authenticate` chặn mọi route khác).
   */
  must_change_password?: boolean
  /** AUTH-FR-011 — bắt buộc có lý do khi Admin khoá tài khoản, ghi cùng lúc với is_active=false (Flow 19) */
  deactivated_at?: Date
  deactivated_reason?: string
  notification_preferences: NotificationPreferences
  /** ALERT-FR-013 — chat id của bot Telegram, có sau khi người dùng gửi `/start <mã>` cho bot */
  telegram_chat_id?: string
  /** sha256 của mã liên kết một lần + hạn dùng (10 phút) */
  telegram_link_code_hash?: string
  telegram_link_expires_at?: Date
  /** AUTH-FR-009 — lưu hash chứ không phải mã thô, để lộ DB cũng không đặt lại được mật khẩu người khác */
  password_reset_token_hash?: string
  password_reset_expires_at?: Date
  /** AUTH-FR-012 — user tự yêu cầu xoá, Admin xử lý trong ≤30 ngày (PRIV-NFR-003) */
  deletion_requested_at?: Date
  /** Lúc đã nhắc Admin yêu cầu xoá sắp quá hạn 30 ngày — nhắc đúng 1 lần cho mỗi yêu cầu */
  deletion_reminder_sent_at?: Date
  /**
   * AUTH-FR-012 — thời điểm Admin đã xoá/ẩn danh hoá xong. Document vẫn ở lại
   * để farm/audit lịch sử không vỡ tham chiếu, nên cần cờ này để phân biệt
   * "đã xoá theo yêu cầu" với "đang bị khoá kỷ luật" (cả hai đều is_active=false).
   */
  deleted_at?: Date
  /** sha256 của refresh token (như OTP/token reset) — lộ DB cũng không dùng được để lấy access token */
  refresh_tokens: Array<{ token_hash: string; expires: Date }>
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
    role:          { type: String, enum: ['ADMIN', 'FARM_OWNER', 'DOMAIN_EXPERT', 'TECHNICIAN'] satisfies Role[], default: 'FARM_OWNER' },
    avatar_url:    { type: String },
    is_active:     { type: Boolean, default: true },
    must_change_password: { type: Boolean, default: false },
    deactivated_at:     { type: Date },
    deactivated_reason: { type: String },
    notification_preferences: {
      push:  { type: Boolean, default: true },
      telegram: { type: Boolean, default: true },
      quiet_hours: {
        start: { type: String, default: '22:00' },
        end:   { type: String, default: '06:00' },
      },
    },
    telegram_chat_id: { type: String },
    // select: false — mã liên kết chỉ luồng /start của bot cần so, không query nào khác được mang ra
    // index sparse: bot công khai, ai cũng nhắn được /start <mã bất kỳ> — mỗi tin không được quét cả bảng users
    telegram_link_code_hash:  { type: String, select: false, index: true, sparse: true },
    telegram_link_expires_at: { type: Date, select: false },
    // select: false — cùng lý do với `provisioned_devices.secret_key_hash`: chỉ
    // luồng đặt lại mật khẩu cần đọc, mọi query khác (kể cả `.lean()` vốn bỏ qua
    // toJSON) không được mang hash này ra ngoài. resetPassword xin lại bằng `+`.
    password_reset_token_hash: { type: String, select: false },
    password_reset_expires_at: { type: Date, select: false },
    deletion_requested_at:     { type: Date },
    deletion_reminder_sent_at: { type: Date },
    deleted_at:                { type: Date },
    refresh_tokens: [{ token_hash: String, expires: Date }],
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
  delete obj.refresh_tokens
  // Mã đặt lại mật khẩu là 6 chữ số hash SHA-256 không salt: dò hết
  // 900.000 khả năng mất dưới 1 giây, nên để lọt hash ra API coi như để lọt mã.
  // Ai đọc được response của GET /admin/users là đổi được mật khẩu của user đang
  // trong 15 phút reset — phải ẩn cùng nhóm với password_hash.
  delete obj.password_reset_token_hash
  delete obj.password_reset_expires_at
  // Client chỉ cần biết đã liên kết Telegram hay chưa, không cần chat id
  obj.telegram_linked = !!obj.telegram_chat_id
  delete obj.telegram_chat_id
  delete obj.telegram_link_code_hash
  delete obj.telegram_link_expires_at
  return obj
}

export const User = model<IUser>('User', userSchema)
