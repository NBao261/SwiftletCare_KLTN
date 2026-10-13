/**
 * migrate-remove-sales.ts — dọn dữ liệu sau khi bỏ role Sales Staff + Module SALES
 * và thêm Farm Operator (SRS v1.23.0). Code mới không còn hiểu `SALES_STAFF`: tài
 * khoản/lời mời mang giá trị này sẽ lỗi validate khi save.
 *
 * Chạy: npm run migrate:remove-sales   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. Xoá lời mời `invited_role: SALES_STAFF` (dữ liệu cũ, không luồng nào dùng).
 * 2. User `role: SALES_STAFF` (nhân viên công ty, module không còn): gỡ khỏi
 *    `farms.members` rồi xoá hẳn.
 * 3. Drop các collection của SALES nếu còn.
 * 4. Member cũ chưa có `role` → `FARM_OWNER` (trước v1.23.0 mọi member đều là Farm Owner).
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

const SALES_COLLECTIONS = [
  'products', 'inventories', 'orders', 'orderitems', 'returnrequests', 'shipments',
  'salesassignments', 'salesassignmentrequests',
]

async function migrate(): Promise<void> {
  await connectDB()
  const db = mongoose.connection.db!

  // Làm việc thẳng trên collection: model đã không còn chấp nhận giá trị SALES_STAFF
  const invitations = await db.collection('invitations').deleteMany({ invited_role: 'SALES_STAFF' })
  logger.info(`[migrate] Xoá ${invitations.deletedCount} lời mời SALES_STAFF`)

  const salesUserIds = await db.collection('users').distinct('_id', { role: 'SALES_STAFF' })
  if (salesUserIds.length > 0) {
    await db.collection('farms').updateMany({}, { $pull: { members: { user_id: { $in: salesUserIds } } } } as never)
    const users = await db.collection('users').deleteMany({ _id: { $in: salesUserIds } })
    logger.info(`[migrate] Xoá ${users.deletedCount} tài khoản SALES_STAFF`)
  }

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name))
  for (const name of SALES_COLLECTIONS) {
    if (!existing.has(name)) continue
    await db.dropCollection(name)
    logger.info(`[migrate] Drop collection ${name}`)
  }

  const members = await db.collection('farms').updateMany(
    { 'members.role': { $exists: false }, members: { $ne: [] } },
    { $set: { 'members.$[m].role': 'FARM_OWNER', 'members.$[m].zone_ids': [] } },
    { arrayFilters: [{ 'm.role': { $exists: false } }] },
  )
  logger.info(`[migrate] Gán role FARM_OWNER cho member cũ ở ${members.modifiedCount} farm`)

  await mongoose.disconnect()
}

migrate().catch((err: Error) => {
  logger.error('[migrate] Failed', { err })
  process.exit(1)
})
