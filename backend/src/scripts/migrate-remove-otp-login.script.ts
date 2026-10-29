/**
 * migrate-remove-otp-login.ts — dọn dữ liệu sau khi bỏ đăng nhập bằng OTP và đăng ký công
 * khai (G-02, Report 3 §1.2, §8): chỉ còn đăng nhập bằng mật khẩu (AUTH-FR-002) và đặt lại
 * mật khẩu (AUTH-FR-009). Tài khoản do Admin tạo hoặc từ link lời mời (AUTH-FR-005c, 010).
 *
 * Chạy: npm run migrate:remove-otp-login   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. `users`: gỡ `otp_code`, `otp_expires` (hash mã OTP cũ không còn ai đọc).
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

export async function migrateRemoveOtpLogin() {
  const users = await mongoose.connection.db!.collection('users').updateMany(
    { $or: [{ otp_code: { $exists: true } }, { otp_expires: { $exists: true } }] },
    { $unset: { otp_code: '', otp_expires: '' } },
  )
  logger.info(`[migrate] Gỡ mã OTP đăng nhập ở ${users.modifiedCount} tài khoản`)
  return { usersUpdated: users.modifiedCount }
}

if (require.main === module) {
  connectDB()
    .then(migrateRemoveOtpLogin)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
