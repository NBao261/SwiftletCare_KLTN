/**
 * migrate-scope-v2.ts — đưa DB đang chạy về phạm vi SRS v2.0.0 (sau Review 1). Code mới
 * không còn hiểu `FARM_OPERATOR`, `BIRD_PANIC`, `LISTED`: bản ghi mang các giá trị này
 * sẽ lỗi validate khi save, và tài khoản Farm Operator cũ sẽ không qua được `requireRole`.
 *
 * Chạy: npm run migrate:scope-v2   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. Role `FARM_OPERATOR` → `DOMAIN_EXPERT` ở `users`, `farms.members[]`, `invitations`
 *    (tin nhắn ticket không còn — migrate:remove-tickets xoá cả collection).
 *    LƯU Ý: đây là đổi TÊN role theo SRS — quyền thì khác hẳn (chuyên gia chỉ đọc + tinh
 *    chỉnh, không vận hành). Người vận hành cũ không phải chuyên gia thì nên gỡ khỏi farm
 *    sau khi chạy (DELETE /farms/:id/members/:userId); script in ra danh sách email, và
 *    in riêng những người trước đây bị giới hạn theo Zone (nay xem được cả farm).
 * 2. Bỏ `zone_ids` khỏi `farms.members[]` và `invitations` (không còn phạm vi theo Zone).
 * 3. `alerts.type` `BIRD_PANIC` → `NOISE_ANOMALY`.
 * 4. Bỏ `relay_states.heating` ở `sensornodes` (không còn relay sưởi).
 * 5. Mẻ thu hoạch `status: LISTED` → `DRAFT`, bỏ `listing_id` (không còn Marketplace).
 * 6. Drop collection `nestlistings`, `contactinquiries`.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

const MARKETPLACE_COLLECTIONS = ['nestlistings', 'contactinquiries']

/** Chạy trên kết nối mongoose đang mở; trả số bản ghi đã đổi ở từng bước */
export async function migrateScopeV2() {
  // Làm việc thẳng trên collection: model mới không còn chấp nhận các giá trị cũ
  const db = mongoose.connection.db!

  const operatorEmails = (await db.collection('users').find({ role: 'FARM_OPERATOR' }, { projection: { email: 1 } }).toArray())
    .map(u => u.email as string)
  // Operator từng bị giới hạn theo Zone sẽ thành chuyên gia xem được CẢ farm — phải nói rõ
  // là ai, trước khi bước 2 xoá mất dấu vết zone_ids.
  const scoped = await db.collection('farms').aggregate<{ _id: unknown; name?: string; user_id: unknown; zones: number }>([
    { $unwind: '$members' },
    { $match: { 'members.role': 'FARM_OPERATOR', 'members.zone_ids.0': { $exists: true } } },
    { $project: { name: 1, user_id: '$members.user_id', zones: { $size: '$members.zone_ids' } } },
  ]).toArray()
  if (scoped.length > 0) {
    const emails = new Map((await db.collection('users').find({ _id: { $in: scoped.map(s => s.user_id) } } as never, { projection: { email: 1 } }).toArray())
      .map(u => [String(u._id), u.email as string]))
    logger.warn('[migrate] Các Operator sau trước đây chỉ được xem một số Zone, nay thành Domain Expert xem được CẢ farm: ' +
      scoped.map(s => `${emails.get(String(s.user_id)) ?? String(s.user_id)} (farm "${s.name ?? String(s._id)}", ${s.zones} Zone)`).join('; '))
  }
  const users = await db.collection('users').updateMany({ role: 'FARM_OPERATOR' }, { $set: { role: 'DOMAIN_EXPERT' } })
  const members = await db.collection('farms').updateMany(
    { 'members.role': 'FARM_OPERATOR' },
    { $set: { 'members.$[m].role': 'DOMAIN_EXPERT' } },
    { arrayFilters: [{ 'm.role': 'FARM_OPERATOR' }] },
  )
  const invitations = await db.collection('invitations').updateMany({ invited_role: 'FARM_OPERATOR' }, { $set: { invited_role: 'DOMAIN_EXPERT' } })
  logger.info(`[migrate] FARM_OPERATOR → DOMAIN_EXPERT: ${users.modifiedCount} user, ${members.modifiedCount} farm, ${invitations.modifiedCount} lời mời`)
  if (operatorEmails.length > 0) {
    logger.warn(`[migrate] Các tài khoản vừa thành Domain Expert (chỉ đọc + tinh chỉnh) — gỡ khỏi farm nếu không phải chuyên gia: ${operatorEmails.join(', ')}`)
  }

  const memberScopes = await db.collection('farms').updateMany(
    { 'members.zone_ids': { $exists: true } },
    { $unset: { 'members.$[].zone_ids': '' } },
  )
  const invitationScopes = await db.collection('invitations').updateMany({ zone_ids: { $exists: true } }, { $unset: { zone_ids: '' } })
  logger.info(`[migrate] Bỏ zone_ids ở ${memberScopes.modifiedCount} farm, ${invitationScopes.modifiedCount} lời mời`)

  const alerts = await db.collection('alerts').updateMany({ type: 'BIRD_PANIC' }, { $set: { type: 'NOISE_ANOMALY' } })
  logger.info(`[migrate] BIRD_PANIC → NOISE_ANOMALY: ${alerts.modifiedCount} cảnh báo`)

  const heating = await db.collection('sensornodes').updateMany(
    { 'relay_states.heating': { $exists: true } },
    { $unset: { 'relay_states.heating': '' } },
  )
  logger.info(`[migrate] Bỏ relay sưởi ở ${heating.modifiedCount} thiết bị`)

  const harvests = await db.collection('harvestbatches').updateMany(
    { $or: [{ status: 'LISTED' }, { listing_id: { $exists: true } }] },
    [{ $set: { status: { $cond: [{ $eq: ['$status', 'LISTED'] }, 'DRAFT', '$status'] } } }, { $unset: 'listing_id' }],
  )
  logger.info(`[migrate] Gỡ trạng thái đăng bán ở ${harvests.modifiedCount} mẻ thu hoạch`)

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name))
  let collectionsDropped = 0
  for (const name of MARKETPLACE_COLLECTIONS) {
    if (!existing.has(name)) continue
    await db.dropCollection(name)
    collectionsDropped++
    logger.info(`[migrate] Drop collection ${name}`)
  }

  return {
    users: users.modifiedCount,
    scopedOperatorsWidened: scoped.length,
    farms: members.modifiedCount,
    invitations: invitations.modifiedCount,
    zoneScopesRemoved: memberScopes.modifiedCount + invitationScopes.modifiedCount,
    alerts: alerts.modifiedCount,
    heatingRemoved: heating.modifiedCount,
    harvests: harvests.modifiedCount,
    collectionsDropped,
  }
}

if (require.main === module) {
  connectDB()
    .then(migrateScopeV2)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
