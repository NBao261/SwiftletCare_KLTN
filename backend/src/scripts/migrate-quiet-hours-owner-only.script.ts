/**
 * migrate-quiet-hours-owner-only (G-32, B-06) — Report 3 §2.4: chỉ Farm Owner đặt giờ im lặng (ALERT-FR-006). Trước
 * G-32 mọi vai trò lưu được giờ im lặng, nên giờ im lặng đã lưu của Farm Technician, Domain Expert và Administrator bị
 * gỡ; kênh đã chọn giữ nguyên. Từ nay `PUT /auth/notification-preferences` từ chối các trường hợp đó (403).
 *
 * Chạy: npm run migrate:quiet-hours-owner-only   (chạy lại nhiều lần vẫn an toàn)
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

export async function migrateQuietHoursOwnerOnly(): Promise<number> {
  const { modifiedCount } = await mongoose.connection.db!.collection('users').updateMany(
    { role: { $ne: 'FARM_OWNER' }, 'notification_preferences.quiet_hours': { $exists: true } },
    { $unset: { 'notification_preferences.quiet_hours': '' } },
  )
  logger.info(`[migrate] gỡ giờ im lặng của ${modifiedCount} tài khoản không phải Farm Owner`)
  return modifiedCount
}

if (require.main === module) {
  connectDB()
    .then(migrateQuietHoursOwnerOnly)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
