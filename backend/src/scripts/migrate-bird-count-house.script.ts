/**
 * migrate-bird-count-house.ts — SRS v2.1.8: camera đếm chim lắp ở cửa ra vào của cả nhà yến nên
 * gắn House, không gắn Zone; số đếm, cảnh báo và mức giảm tỷ lệ chim về cũng theo House.
 *
 * Chạy: npm run migrate:bird-count-house   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. camera_nodes, bird_count_records, bird_count_buckets: `zone_id` → `house_id` (House chứa Zone).
 *    Bản ghi đếm bỏ luôn `return_rate` cũ lưu theo camera (giờ tính cho cả nhà lúc đọc).
 * 2. Cảnh báo của camera (EDGE_AI_DEGRADED, LOW_RETURN_RATE) đang gắn Zone → gắn House.
 * 3. `zones.detection_tuning.return_rate_drop_pct` → `houses.bird_count_tuning.return_rate_drop_pct`:
 *    các Zone của nhà cùng 1 giá trị thì lấy giá trị đó; khác nhau thì lấy của Zone từng lắp camera;
 *    vẫn không rõ thì giữ mặc định và in ra để Domain Expert đặt lại (không tự đoán).
 * 4. syncIndexes các model đổi index.
 */
import 'dotenv/config'
import mongoose, { Types } from 'mongoose'
import { connectDB } from '@/config/db.config'
import { Alert } from '@/models/alert.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { CameraNode } from '@/models/device.model'
import logger from '@/utils/logger.util'

const CAMERA_ALERT_TYPES = ['EDGE_AI_DEGRADED', 'LOW_RETURN_RATE']

export async function migrateBirdCountHouse() {
  // Thẳng trên collection: schema mới không còn `zone_id` của camera/bản ghi đếm
  const db = mongoose.connection.db!
  const houseOfZone = new Map<string, Types.ObjectId>()
  for (const z of await db.collection('zones').find({}, { projection: { house_id: 1 } }).toArray()) {
    houseOfZone.set(String(z._id), z.house_id as Types.ObjectId)
  }

  // Zone từng lắp camera — dùng ở bước 3, phải đọc trước khi bước 1 xoá zone_id
  const cameraZones = new Set(
    (await db.collection('cameranodes').distinct('zone_id', { zone_id: { $exists: true } })).map(String),
  )

  const moved: Record<string, number> = {}
  const orphans: string[] = []
  for (const name of ['cameranodes', 'birdcountrecords', 'birdcountbuckets']) {
    const col = db.collection(name)
    moved[name] = 0
    for (const doc of await col.find({ zone_id: { $exists: true } }, { projection: { zone_id: 1 } }).toArray()) {
      const houseId = houseOfZone.get(String(doc.zone_id))
      if (!houseId) {
        orphans.push(`${name} ${String(doc._id)} (zone ${String(doc.zone_id)} không còn)`)
        continue
      }
      await col.updateOne({ _id: doc._id }, { $set: { house_id: houseId }, $unset: { zone_id: '', return_rate: '' } })
      moved[name] += 1
    }
  }

  let alertsMoved = 0
  for (const alert of await db.collection('alerts').find(
    { type: { $in: CAMERA_ALERT_TYPES }, zone_id: { $exists: true }, house_id: { $exists: false } },
    { projection: { zone_id: 1 } },
  ).toArray()) {
    const houseId = houseOfZone.get(String(alert.zone_id))
    if (!houseId) continue
    await db.collection('alerts').updateOne({ _id: alert._id }, { $set: { house_id: houseId }, $unset: { zone_id: '' } })
    alertsMoved += 1
  }

  const needsExpert: string[] = []
  let housesTuned = 0
  const zonesWithDrop = await db.collection('zones').find(
    { 'detection_tuning.return_rate_drop_pct': { $exists: true } },
    { projection: { house_id: 1, name: 1, 'detection_tuning.return_rate_drop_pct': 1 } },
  ).toArray()
  const byHouse = new Map<string, typeof zonesWithDrop>()
  for (const z of zonesWithDrop) byHouse.set(String(z.house_id), [...(byHouse.get(String(z.house_id)) ?? []), z])

  for (const [houseId, zones] of byHouse) {
    const house = await db.collection('houses').findOne({ _id: new Types.ObjectId(houseId) }, { projection: { name: 1, bird_count_tuning_history: 1 } })
    // Domain Expert đã đặt mức của House qua endpoint mới thì không ghi đè. Không dựa vào việc House
    // đã có giá trị: House lưu lại sau khi deploy tự nhận mặc định 20% của schema.
    if (!house || ((house.bird_count_tuning_history as unknown[] | undefined)?.length ?? 0) > 0) continue
    const drop = (z: (typeof zones)[number]) => z.detection_tuning.return_rate_drop_pct as number
    const values = [...new Set(zones.map(drop))]
    const fromCamera = zones.filter(z => cameraZones.has(String(z._id))).map(drop)
    const value = values.length === 1 ? values[0] : new Set(fromCamera).size === 1 ? fromCamera[0] : undefined
    // Chạy lại sau khi bước dưới đã $unset zone thì không còn Zone nào ở đây — an toàn
    if (value === undefined) {
      needsExpert.push(`${house.name as string} (${houseId}): ${zones.map(z => `${z.name as string}=${drop(z)}%`).join(', ')}`)
      continue
    }
    await db.collection('houses').updateOne({ _id: house._id }, { $set: { 'bird_count_tuning.return_rate_drop_pct': value } })
    housesTuned += 1
  }
  const { modifiedCount: zonesCleaned } = await db.collection('zones').updateMany(
    { 'detection_tuning.return_rate_drop_pct': { $exists: true } }, { $unset: { 'detection_tuning.return_rate_drop_pct': '' } },
  )

  for (const model of [CameraNode, BirdCountRecord, BirdCountBucket, Alert] as const) {
    logger.info(`[migrate] ${model.collection.collectionName}: index đã xoá`, { dropped: await (model as typeof Alert).syncIndexes() })
  }

  logger.info('[migrate] zone_id → house_id', { ...moved, alerts: alertsMoved, housesTuned, zonesCleaned })
  if (orphans.length) logger.warn(`[migrate] Bản ghi trỏ tới Zone không còn, giữ nguyên để xem tay: ${orphans.join('; ')}`)
  if (needsExpert.length) {
    logger.warn(`[migrate] Các Zone của nhà đặt mức giảm khác nhau, House giữ mặc định 20% — Domain Expert đặt lại qua PUT /farms/houses/:houseId/bird-count-tuning: ${needsExpert.join('; ')}`)
  }
  return { moved, alertsMoved, housesTuned, zonesCleaned, orphans, needsExpert }
}

if (require.main === module) {
  connectDB()
    .then(migrateBirdCountHouse)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
