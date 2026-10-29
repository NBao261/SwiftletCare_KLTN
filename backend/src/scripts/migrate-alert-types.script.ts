/**
 * migrate-alert-types.ts — đưa dữ liệu cũ về enum của SRS 3.1.0 (G-01, Report 4 §6.4).
 *
 * Chạy: npm run migrate:alert-types   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. `alerts.type` `PUMP_DRY` → `MISTING_INEFFECTIVE`, `POWER_OUTAGE` → `UNEXPECTED_RESTART`
 *    (THREAT-FR-011, 012); xoá cảnh báo `PREDATOR_DETECTED` (Report 3 §8).
 * 2. `sensornodes`, `cameranodes`: trạng thái `ERROR`/`DEGRADED` → `ONLINE` (Report 3 §6.6; heartbeat
 *    kế tiếp hoặc job offline sẽ đặt lại đúng); bỏ `relay_states.heating` còn sót.
 * 3. `harvestbatches.status` `ARCHIVED` → `DRAFT`.
 * 4. `users`: bỏ `notification_preferences.zalo`, `.sms` (Report 3 §8).
 * 5. `systemsettings`: bỏ `sla_hours` (cũng có trong migrate:remove-tickets — để chạy riêng
 *    script này vẫn đủ).
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

const RENAMED_ALERT_TYPES: Record<string, string> = {
  PUMP_DRY:     'MISTING_INEFFECTIVE',
  POWER_OUTAGE: 'UNEXPECTED_RESTART',
}
const DROPPED_DEVICE_STATUSES = ['ERROR', 'DEGRADED']

export async function migrateAlertTypes() {
  const db = mongoose.connection.db!

  let alertsRenamed = 0
  for (const [from, to] of Object.entries(RENAMED_ALERT_TYPES)) {
    const res = await db.collection('alerts').updateMany({ type: from }, { $set: { type: to } })
    alertsRenamed += res.modifiedCount
    logger.info(`[migrate] ${from} → ${to}: ${res.modifiedCount} cảnh báo`)
  }
  const predators = await db.collection('alerts').deleteMany({ type: 'PREDATOR_DETECTED' })
  logger.info(`[migrate] Xoá ${predators.deletedCount} cảnh báo PREDATOR_DETECTED`)

  let devicesOnline = 0
  for (const name of ['sensornodes', 'cameranodes']) {
    const res = await db.collection(name).updateMany(
      { status: { $in: DROPPED_DEVICE_STATUSES } },
      { $set: { status: 'ONLINE' } },
    )
    devicesOnline += res.modifiedCount
  }
  logger.info(`[migrate] ERROR/DEGRADED → ONLINE: ${devicesOnline} thiết bị`)

  const heating = await db.collection('sensornodes').updateMany(
    { 'relay_states.heating': { $exists: true } },
    { $unset: { 'relay_states.heating': '' } },
  )
  logger.info(`[migrate] Bỏ relay sưởi ở ${heating.modifiedCount} thiết bị`)

  const harvests = await db.collection('harvestbatches').updateMany({ status: 'ARCHIVED' }, { $set: { status: 'DRAFT' } })
  logger.info(`[migrate] ARCHIVED → DRAFT: ${harvests.modifiedCount} mẻ thu hoạch`)

  const users = await db.collection('users').updateMany(
    { $or: [{ 'notification_preferences.zalo': { $exists: true } }, { 'notification_preferences.sms': { $exists: true } }] },
    { $unset: { 'notification_preferences.zalo': '', 'notification_preferences.sms': '' } },
  )
  logger.info(`[migrate] Bỏ tuỳ chọn Zalo/SMS ở ${users.modifiedCount} tài khoản`)

  const settings = await db.collection('systemsettings').updateMany(
    { sla_hours: { $exists: true } },
    { $unset: { sla_hours: '' } },
  )
  logger.info(`[migrate] Bỏ sla_hours ở ${settings.modifiedCount} system setting`)

  return {
    alertsRenamed,
    predatorAlertsDeleted: predators.deletedCount,
    devicesOnline,
    heatingRemoved: heating.modifiedCount,
    harvests: harvests.modifiedCount,
    users: users.modifiedCount,
    settings: settings.modifiedCount,
  }
}

if (require.main === module) {
  connectDB()
    .then(migrateAlertTypes)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
