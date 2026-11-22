// gỡ otp_code, otp_expires. Chạy lại an toàn
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
