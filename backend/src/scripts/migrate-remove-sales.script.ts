// xoá lời mời và user SALES_STAFF, drop collection SALES, member thiếu role → FARM_OWNER. Chạy lại an toàn
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

  // Thẳng trên collection: model không còn nhận SALES_STAFF
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
    { $set: { 'members.$[m].role': 'FARM_OWNER' } },
    { arrayFilters: [{ 'm.role': { $exists: false } }] },
  )
  logger.info(`[migrate] Gán role FARM_OWNER cho member cũ ở ${members.modifiedCount} farm`)

  await mongoose.disconnect()
}

migrate().catch((err: Error) => {
  logger.error('[migrate] Failed', { err })
  process.exit(1)
})
