/** G-20: lô DRAFT do Farm Owner tạo → CONFIRMED; lô của Farm Technician giữ DRAFT. Chạy lại an toàn */
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
