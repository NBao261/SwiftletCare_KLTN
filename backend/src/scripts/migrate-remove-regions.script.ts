// Gỡ assigned_regions, region và index region_1; in farm chưa có tọa độ. Chạy lại an toàn
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

export async function migrateRemoveRegions() {
  const db = mongoose.connection.db!
  const users = await db.collection('users').updateMany({ assigned_regions: { $exists: true } }, { $unset: { assigned_regions: '' } })
  const farms = await db.collection('farms').updateMany({ region: { $exists: true } }, { $unset: { region: '' } })
  logger.info(`[migrate] Gỡ khu vực ở ${users.modifiedCount} user, ${farms.modifiedCount} farm`)

  const indexes = await db.collection('farms').indexes().catch(() => [])
  const droppedIndex = indexes.some(i => i.name === 'region_1')
  if (droppedIndex) await db.collection('farms').dropIndex('region_1')

  const withoutCoordinates = (await db.collection('farms')
    .find({ is_deleted: { $ne: true }, 'coordinates.lat': { $exists: false } }, { projection: { name: 1 } }).toArray())
    .map(f => `${f.name as string} (${String(f._id)})`)
  if (withoutCoordinates.length) logger.warn(`[migrate] Farm chưa có tọa độ (không có thời tiết): ${withoutCoordinates.join('; ')}`)

  return { usersUpdated: users.modifiedCount, farmsUpdated: farms.modifiedCount, droppedIndex, withoutCoordinates }
}

if (require.main === module) {
  connectDB()
    .then(migrateRemoveRegions)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
