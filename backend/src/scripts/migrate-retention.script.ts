/**
 * migrate-retention.ts — đưa DB đang chạy về đúng index/TTL trong schema và dọn
 * alert trùng sinh ra trước khi có dedup theo sự cố (ALERT-FR-008).
 *
 * Chạy: npm run migrate:retention   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. collMod TTL telemetries.timestamp_1 → TELEMETRY_TTL_SECONDS — Mongoose không
 *    tự sửa expireAfterSeconds của index đã tồn tại.
 * 2. syncIndexes Telemetry + Alert — xoá index không còn trong schema
 *    (node_id_1_timestamp_-1, index dedup cũ của alert), tạo index mới.
 * 3. Mỗi sự cố {farm, zone, node, type} chỉ giữ 1 alert đang mở (bản mới nhất,
 *    occurrence_count = số bản trùng), các bản còn lại → RESOLVED.
 * 4. Đóng ticket đang mở của Farm đã xoá mềm — dữ liệu sinh ra trước khi
 *    `removeFarm`/xoá tài khoản biết đóng ticket. Không ai mở được chúng nữa
 *    (kể cả Admin) nhưng chúng vẫn chiếm suất quá tải của Technician và vẫn
 *    cộng vào báo cáo.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { Telemetry, TELEMETRY_TTL_SECONDS } from '@/models/telemetry.model'
import { Alert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { Ticket } from '@/models/ticket.model'
import { logAction } from '@/services/auditLog.service'
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

  // `.collection` để đi vòng qua hook `pre('find')` của Farm — hook đó luôn ép
  // is_deleted: false nên không query được chính các farm đã xoá.
  const deletedFarmIds = await Farm.collection.distinct('_id', { is_deleted: true })
  const now = new Date()
  let closedTickets = 0
  for (const farmId of deletedFarmIds) {
    const res = await Ticket.updateMany(
      { farm_id: farmId, status: { $ne: 'CLOSED' } },
      {
        $set: { status: 'CLOSED', closed_at: now, cancelled_at: now },
        $push: { notes: { content: 'Đóng khi dọn dữ liệu: farm của ticket này đã bị xoá', created_at: now } },
      },
    )
    if (res.modifiedCount === 0) continue
    // 1 bản ghi audit cho mỗi farm (không phải mỗi ticket) để không làm ngập
    // audit log; cũng không gửi thông báo vì đây là dữ liệu tồn đã cũ.
    await logAction(undefined, 'TICKET_CLOSED_FARM_DELETED', 'farm', String(farmId), {
      closedTickets: res.modifiedCount, via: 'migrate:retention',
    })
    closedTickets += res.modifiedCount
  }
  logger.info(`[migrate] Đóng ${closedTickets} ticket của ${deletedFarmIds.length} farm đã xoá mềm`)

  await mongoose.disconnect()
}

migrate().catch((err: Error) => {
  logger.error('[migrate] Failed', { err })
  process.exit(1)
})
