/** Sửa TTL (Mongoose không sửa index đã có), syncIndexes, gộp alert mở trùng sự cố. Chạy lại an toàn */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { Telemetry, TELEMETRY_TTL_SECONDS } from '@/models/telemetry.model'
import { Alert } from '@/models/alert.model'
import logger from '@/utils/logger.util'

async function migrate(): Promise<void> {
  await connectDB()
  const db = mongoose.connection.db!

  const hasTtlIndex = (await Telemetry.collection.indexes()).some(i => i.name === 'timestamp_1')
  if (hasTtlIndex) {
    await db.command({ collMod: Telemetry.collection.collectionName, index: { name: 'timestamp_1', expireAfterSeconds: TELEMETRY_TTL_SECONDS } })
    logger.info(`[migrate] telemetries TTL → ${TELEMETRY_TTL_SECONDS / 86400} ngày`)
  }

  logger.info('[migrate] telemetries: index đã xoá', { dropped: await Telemetry.syncIndexes() })
  logger.info('[migrate] alerts: index đã xoá', { dropped: await Alert.syncIndexes() })

  const groups = await Alert.aggregate<{ ids: mongoose.Types.ObjectId[] }>([
    { $match: { status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] } } },
    { $sort: { created_at: -1 } },
    { $group: { _id: { farm: '$farm_id', zone: '$zone_id', node: '$node_id', type: '$type' }, ids: { $push: '$_id' } } },
    { $match: { 'ids.1': { $exists: true } } },
  ])
  let resolved = 0
  for (const { ids: [keep, ...dupes] } of groups) {
    await Alert.updateOne({ _id: keep }, { $set: { occurrence_count: dupes.length + 1 } })
    const res = await Alert.updateMany(
      { _id: { $in: dupes } },
      { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: 'Gộp vào cảnh báo mới nhất của cùng sự cố' },
    )
    resolved += res.modifiedCount
  }
  logger.info(`[migrate] Gộp ${groups.length} sự cố, đóng ${resolved} alert trùng`)

  await mongoose.disconnect()
}

migrate().catch((err: Error) => {
  logger.error('[migrate] Failed', { err })
  process.exit(1)
})
