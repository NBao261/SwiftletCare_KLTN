// users is_active → status (khoá thắng chờ xoá), auditlogs ip_address → source_ip, before/after ra trường riêng. Chạy lại an toàn
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

export async function migrateErdFields() {
  const db = mongoose.connection.db!
  const users = db.collection('users')
  const noStatus = { status: { $exists: false } }
  const deleted = await users.updateMany({ ...noStatus, deleted_at: { $ne: null } }, { $set: { status: 'DELETED' } })
  const locked = await users.updateMany(
    { ...noStatus, is_active: false },
    [{ $set: { status: 'LOCKED', locked_reason: '$deactivated_reason', locked_at: '$deactivated_at' } }],
  )
  const deletionRequested = await users.updateMany(
    { ...noStatus, deletion_requested_at: { $ne: null } }, { $set: { status: 'DELETION_REQUESTED' } },
  )
  const active = await users.updateMany(noStatus, { $set: { status: 'ACTIVE' } })
  await users.updateMany(
    { $or: [{ is_active: { $exists: true } }, { deactivated_reason: { $exists: true } }, { deactivated_at: { $exists: true } }] },
    { $unset: { is_active: '', deactivated_reason: '', deactivated_at: '' } },
  )

  const audit = db.collection('auditlogs')
  const renamed = await audit.updateMany({ ip_address: { $exists: true } }, { $rename: { ip_address: 'source_ip' } })
  const lifted = await audit.updateMany(
    { 'metadata.before': { $exists: true }, before: { $exists: false } },
    [{ $set: { before: '$metadata.before', after: '$metadata.after' } }],
  )

  const result = {
    usersDeleted: deleted.modifiedCount, usersDeletionRequested: deletionRequested.modifiedCount,
    usersLocked: locked.modifiedCount, usersActive: active.modifiedCount,
    auditIpRenamed: renamed.modifiedCount, auditBeforeAfter: lifted.modifiedCount,
  }
  logger.info('[migrate] Trường theo ERD (G-14)', result)
  return result
}

if (require.main === module) {
  connectDB()
    .then(migrateErdFields)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
