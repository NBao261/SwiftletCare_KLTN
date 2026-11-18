/**
 * migrate-erd-fields.ts — dữ liệu cũ theo ERD của Report 4 §6.1, §6.4 (G-14).
 *
 * Chạy: npm run migrate:erd-fields   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. `users`: `is_active` → `status` (SM-14): đã xoá theo yêu cầu → DELETED; đang chờ xoá → DELETION_REQUESTED;
 *    bị khoá → LOCKED với `locked_reason`, `locked_at` lấy từ `deactivated_*`; còn lại ACTIVE. Bỏ `is_active`,
 *    `deactivated_reason`, `deactivated_at`. Chỉ đụng tài khoản chưa có `status`.
 * 2. `auditlogs`: `ip_address` → `source_ip`; `metadata.before`/`after` chép ra `before`/`after` của dòng.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

export async function migrateErdFields() {
  const db = mongoose.connection.db!
  const users = db.collection('users')
  const noStatus = { status: { $exists: false } }
  const deleted = await users.updateMany({ ...noStatus, deleted_at: { $ne: null } }, { $set: { status: 'DELETED' } })
  const deletionRequested = await users.updateMany(
    { ...noStatus, deletion_requested_at: { $ne: null } }, { $set: { status: 'DELETION_REQUESTED' } },
  )
  const locked = await users.updateMany(
    { ...noStatus, is_active: false },
    [{ $set: { status: 'LOCKED', locked_reason: '$deactivated_reason', locked_at: '$deactivated_at' } }],
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
