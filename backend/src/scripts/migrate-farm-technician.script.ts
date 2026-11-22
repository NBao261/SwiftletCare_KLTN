/** G-20: TECHNICIAN → FARM_TECHNICIAN, thu hồi refresh token, không thêm vào farm nào; audit giữ nguyên. Chạy lại an toàn */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

export async function migrateFarmTechnician() {
  const users = mongoose.connection.db!.collection('users')
  const legacy = await users.find({ role: 'TECHNICIAN' }).project({ email: 1 }).toArray()
  const result = await users.updateMany(
    { role: 'TECHNICIAN' },
    { $set: { role: 'FARM_TECHNICIAN', refresh_tokens: [] } },
  )
  logger.info(`[migrate] Đổi ${result.modifiedCount} tài khoản Technician sang FARM_TECHNICIAN (chưa thuộc farm nào)`)
  if (legacy.length) {
    logger.warn(`[migrate] Farm Owner cần mời các tài khoản này vào farm rồi gán vào nhà: ${legacy.map(u => String(u.email)).join(', ')}`)
  }
  return { usersUpdated: result.modifiedCount }
}

if (require.main === module) {
  connectDB()
    .then(migrateFarmTechnician)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
