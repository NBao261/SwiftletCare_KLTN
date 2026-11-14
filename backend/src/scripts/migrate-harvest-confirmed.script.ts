/**
 * migrate-harvest-confirmed.ts — lô thu hoạch có thêm trạng thái CONFIRMED (G-20, HARVEST-FR-001, 006): lô
 * của Farm Technician chờ Farm Owner xác nhận (DRAFT), lô của Farm Owner xác nhận ngay. Trước đây mọi lô
 * đều DRAFT và chỉ Farm Owner nhập được.
 *
 * Chạy: npm run migrate:harvest-confirmed   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. `harvestbatches`: lô DRAFT do tài khoản FARM_OWNER tạo → CONFIRMED, `confirmed_by` = người tạo,
 *    `confirmed_at` = lúc tạo. Lô của Farm Technician giữ DRAFT.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

export async function migrateHarvestConfirmed() {
  const db = mongoose.connection.db!
  const owners = await db.collection('users').find({ role: 'FARM_OWNER' }).project({ _id: 1 }).toArray()
  const result = await db.collection('harvestbatches').updateMany(
    { status: 'DRAFT', created_by: { $in: owners.map(u => u._id) } },
    [{ $set: { status: 'CONFIRMED', confirmed_by: '$created_by', confirmed_at: '$created_at' } }],
  )
  logger.info(`[migrate] Xác nhận ${result.modifiedCount} lô thu hoạch do Farm Owner nhập`)
  return { batchesConfirmed: result.modifiedCount }
}

if (require.main === module) {
  connectDB()
    .then(migrateHarvestConfirmed)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
