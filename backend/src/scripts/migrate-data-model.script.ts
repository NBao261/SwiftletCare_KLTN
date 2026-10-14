/**
 * migrate-data-model.ts — đưa DB đang chạy về đúng data model sau đợt rà soát DB
 * (SRS v1.23.0 §8.2). Cần chạy TRƯỚC khi deploy code mới: code đọc `zones.farm_id`
 * và `users.refresh_tokens[].token_hash`.
 *
 * Chạy: npm run migrate:data-model   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. `zones.farm_id` — điền từ House (Zone không bao giờ đổi farm).
 * 2. Refresh token cũ lưu dạng thô → `token_hash` (sha256), bỏ token đã hết hạn.
 *    Người dùng không bị đăng xuất.
 * 3. Mẻ thu hoạch có >1 tin đăng (trước khi có unique index): giữ tin mà mẻ trỏ tới
 *    (`listing_id`, không có thì tin cũ nhất), chuyển liên hệ của tin thừa sang, xoá
 *    tin thừa. Phải làm trước bước 5, nếu không unique index không tạo được.
 * 4. Lời mời PENDING của farm đã xoá mềm → EXPIRED (tránh auto-accept vào farm đã xoá).
 * 5. Tạo index mới trong schema (không xoá index nào).
 */
import 'dotenv/config'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { NestListing } from '@/models/nestListing.model'
import { ContactInquiry } from '@/models/contactInquiry.model'
import logger from '@/utils/logger.util'

type RawToken = { token?: string; token_hash?: string; expires: Date }

/** Chạy trên kết nối mongoose đang mở; trả số bản ghi đã đổi ở từng bước */
export async function migrateDataModel() {
  // Làm việc thẳng trên collection: schema mới không còn field refresh_tokens[].token
  const db = mongoose.connection.db!
  const now = new Date()

  let zones = 0
  for (const house of await db.collection('houses').find({}, { projection: { farm_id: 1 } }).toArray()) {
    const res = await db.collection('zones').updateMany(
      { house_id: house._id, farm_id: { $exists: false } },
      { $set: { farm_id: house.farm_id } },
    )
    zones += res.modifiedCount
  }
  logger.info(`[migrate] Điền farm_id cho ${zones} zone`)

  let tokenUsers = 0
  const users = db.collection('users')
  for (const user of await users.find({ 'refresh_tokens.token': { $exists: true } }).toArray()) {
    const tokens = (user.refresh_tokens as RawToken[])
      .filter(t => t.expires > now)
      .map(t => ({
        token_hash: t.token_hash ?? crypto.createHash('sha256').update(t.token!).digest('hex'),
        expires: t.expires,
      }))
    await users.updateOne({ _id: user._id }, { $set: { refresh_tokens: tokens } })
    tokenUsers++
  }
  const pruned = await users.updateMany(
    { 'refresh_tokens.expires': { $lte: now } },
    { $pull: { refresh_tokens: { expires: { $lte: now } } } } as never,
  )
  logger.info(`[migrate] Băm refresh token của ${tokenUsers} user, dọn token hết hạn ở ${pruned.modifiedCount} user`)

  const dupes = await db.collection('nestlistings').aggregate<{ _id: mongoose.Types.ObjectId; ids: mongoose.Types.ObjectId[] }>([
    { $sort: { created_at: 1 } },
    { $group: { _id: '$harvest_batch_id', ids: { $push: '$_id' } } },
    { $match: { 'ids.1': { $exists: true } } },
  ]).toArray()
  let listingsRemoved = 0
  for (const { _id: batchId, ids } of dupes) {
    const batch = await db.collection('harvestbatches').findOne({ _id: batchId }, { projection: { listing_id: 1 } })
    const keep = ids.find(id => batch?.listing_id && id.equals(batch.listing_id)) ?? ids[0]
    const extra = ids.filter(id => !id.equals(keep))
    await db.collection('contactinquiries').updateMany({ listing_id: { $in: extra } }, { $set: { listing_id: keep } })
    listingsRemoved += (await db.collection('nestlistings').deleteMany({ _id: { $in: extra } })).deletedCount
    await db.collection('harvestbatches').updateOne({ _id: batchId }, { $set: { listing_id: keep } })
  }
  logger.info(`[migrate] Gộp tin đăng trùng ở ${dupes.length} mẻ, xoá ${listingsRemoved} tin thừa`)

  const deletedFarmIds = await db.collection('farms').distinct('_id', { is_deleted: true })
  const invitations = await db.collection('invitations').updateMany(
    { farm_id: { $in: deletedFarmIds }, status: 'PENDING' },
    { $set: { status: 'EXPIRED' } },
  )
  logger.info(`[migrate] Huỷ ${invitations.modifiedCount} lời mời của farm đã xoá`)

  await Promise.all([Farm, House, Zone, HarvestBatch, NestListing, ContactInquiry].map(m => m.createIndexes()))
  logger.info('[migrate] Đã tạo index mới')

  return { zones, tokenUsers, tokensPruned: pruned.modifiedCount, listingsRemoved, invitationsExpired: invitations.modifiedCount }
}

if (require.main === module) {
  connectDB()
    .then(migrateDataModel)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
