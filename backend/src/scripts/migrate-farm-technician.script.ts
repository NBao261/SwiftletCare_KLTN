/**
 * migrate-farm-technician.ts — đổi role Technician cũ sang Farm Technician (G-20, Report 3 4.x,
 * AUTH-FR-004, 005, 013). Technician cũ làm trên mọi farm do Admin tạo; Farm Technician là thợ của
 * chủ farm, thành viên farm, chỉ thao tác trên nhà được giao.
 *
 * Chạy: npm run migrate:farm-technician   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. `users`: `role: TECHNICIAN` → `FARM_TECHNICIAN`, thu hồi refresh token để app đăng nhập lại và
 *    nhận role mới (backend đọc role từ DB mỗi request nên quyền đổi ngay). Không thêm vào farm nào:
 *    tài khoản chưa làm được gì cho tới khi Farm Owner mời vào farm (cùng email) và gán vào nhà.
 * 2. `audit_logs.actor_role = TECHNICIAN` là lịch sử, giữ nguyên.
 */
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
