/**
 * migrate-relay-overrides.ts — controller đang can thiệp tay từ trước G-06 phần 2 (BR-20).
 *
 * Chạy: npm run migrate:relay-overrides   (1 lần sau khi triển khai G-06 phần 2; chạy lại vẫn an toàn)
 *
 * Bản ghi cũ chỉ có `control_mode: MANUAL` + `override_expiry` cho cả thiết bị, chưa có `relays`, nên
 * Mongoose đọc lên thành 3 relay AUTO: job hết hạn bỏ qua chúng và huỷ từng relay không làm gì cho tới
 * khi thiết bị gửi `relay/status`. Script đặt `relays` cho các node đó:
 * 1. Relay có lịch sử can thiệp còn mở (`relayoverridelogs`, `ended_at: null`, mỗi relay một bản ghi
 *    từ G-06 phần 1) → MANUAL với hạn và người bật của bản ghi đó.
 * 2. Không có lịch sử mở nhưng còn `override_expiry` → cả 3 relay MANUAL với hạn đó, như firmware cũ
 *    áp cho cả thiết bị. Hạn đã qua thì job hết hạn trả về AUTO ở phút kế và gửi `clear_override`.
 * 3. Không có gì để dựa vào → về AUTO.
 */
import 'dotenv/config'
import mongoose, { Types } from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

/** Ảnh chụp danh sách relay lúc viết script, không import service để script không kéo MQTT theo */
const RELAYS = ['misting', 'speaker', 'ventilation'] as const

interface OpenLog { relay: string; expires_at: Date; started_by: Types.ObjectId }

export async function migrateRelayOverrides() {
  const db = mongoose.connection.db!
  const nodes = await db.collection('sensornodes').find({
    control_mode: 'MANUAL',
    $nor: RELAYS.map(name => ({ [`relays.${name}.mode`]: 'MANUAL' })),
  }).project({ _id: 1, device_id: 1, override_expiry: 1, override_by: 1 }).toArray()

  const counts = { fromLogs: 0, fromExpiry: 0, toAuto: 0 }
  for (const node of nodes) {
    const logs = await db.collection<OpenLog>('relayoverridelogs')
      .find({ node_id: node._id, ended_at: null, relay: { $in: [...RELAYS] } })
      .sort({ started_at: 1 }).toArray()
    const latest = new Map(logs.map(l => [l.relay, l]))   // nhiều bản ghi mở cho 1 relay: lấy bản mới nhất

    const set: Record<string, unknown> = {}
    if (latest.size > 0) {
      for (const [relay, log] of latest) {
        set[`relays.${relay}`] = { mode: 'MANUAL', override_expiry: log.expires_at, override_by: log.started_by }
      }
      set.override_expiry = new Date(Math.max(...[...latest.values()].map(l => l.expires_at.getTime())))
      counts.fromLogs++
    } else if (node.override_expiry) {
      for (const relay of RELAYS) {
        set[`relays.${relay}`] = { mode: 'MANUAL', override_expiry: node.override_expiry, ...(node.override_by ? { override_by: node.override_by } : {}) }
      }
      counts.fromExpiry++
    } else {
      await db.collection('sensornodes').updateOne({ _id: node._id }, { $set: { control_mode: 'AUTO' }, $unset: { override_expiry: '' } })
      logger.warn(`[migrate] ${node.device_id}: MANUAL nhưng không có hạn lẫn lịch sử can thiệp mở — đặt về AUTO`)
      counts.toAuto++
      continue
    }
    await db.collection('sensornodes').updateOne({ _id: node._id }, { $set: set })
  }

  logger.info(`[migrate] Relay theo lịch sử mở: ${counts.fromLogs}, theo hạn cũ: ${counts.fromExpiry}, về AUTO: ${counts.toAuto}`)
  return counts
}

if (require.main === module) {
  connectDB()
    .then(migrateRelayOverrides)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
