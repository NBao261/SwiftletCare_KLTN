/**
 * migrate-alert-incidents — đưa cảnh báo đang mở về hai quy tắc của G-32 trước khi chạy code mới:
 *
 * 1. Mức theo loại (ALERT-FR-001, BR-15): trước đây backend giữ mức do thiết bị gửi (firmware gửi `SPEAKER_FAILURE`
 *    là CRITICAL), nên cảnh báo đang mở được đặt lại theo `DEFAULT_SEVERITY`.
 * 2. Mỗi sự cố một cảnh báo còn mở (ALERT-FR-008): điền `incident_key`, gộp các bản trùng còn mở vào bản cũ nhất
 *    (giữ xác nhận, định tuyến và Work Order của lần báo đầu; `occurrence_count` cộng dồn), các bản còn lại → RESOLVED;
 *    sau đó mới tạo chỉ mục duy nhất, vì chỉ mục không tạo được khi còn bản trùng.
 *
 * Chạy: npm run migrate:alert-incidents   (chạy lại nhiều lần vẫn an toàn)
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { Alert, OPEN_ALERT_STATUSES, incidentKeyOf } from '@/models/alert.model'
import { DEFAULT_SEVERITY } from '@/services/alert.service'
import type { AlertType } from '@/types'
import logger from '@/utils/logger.util'

export async function migrateAlertIncidents(): Promise<{ open: number; reseverity: number; keyed: number; merged: number }> {
  const open = await Alert.find({ status: { $in: OPEN_ALERT_STATUSES } })
    .select('type farm_id zone_id house_id node_id details severity incident_key occurrence_count created_at')
    .sort({ created_at: 1 })
    .lean()

  let reseverity = 0
  let keyed = 0
  const kept = new Map<string, { id: mongoose.Types.ObjectId; occurrences: number }>()
  const duplicates: mongoose.Types.ObjectId[] = []
  for (const alert of open) {
    const severity = DEFAULT_SEVERITY[alert.type as AlertType]
    const key = incidentKeyOf(alert)
    const set: Record<string, unknown> = {}
    if (severity && alert.severity !== severity) { set.severity = severity; reseverity++ }
    if (alert.incident_key !== key) { set.incident_key = key; keyed++ }
    if (Object.keys(set).length) await Alert.updateOne({ _id: alert._id }, { $set: set })

    const first = kept.get(key)
    if (!first) kept.set(key, { id: alert._id, occurrences: alert.occurrence_count ?? 1 })
    else {
      first.occurrences += alert.occurrence_count ?? 1
      duplicates.push(alert._id)
    }
  }

  if (duplicates.length) {
    await Alert.updateMany(
      { _id: { $in: duplicates } },
      { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: 'Gộp vào cảnh báo đầu tiên của cùng sự cố' },
    )
    for (const { id, occurrences } of kept.values()) {
      await Alert.updateOne({ _id: id }, { $set: { occurrence_count: occurrences } })
    }
  }
  logger.info(`[migrate] alerts mở: ${open.length}; đặt lại mức ${reseverity}; điền khoá ${keyed}; gộp ${duplicates.length} bản trùng`)

  await Alert.createIndexes()
  logger.info('[migrate] alerts: chỉ mục incident_key đã có')
  return { open: open.length, reseverity, keyed, merged: duplicates.length }
}

if (require.main === module) {
  connectDB()
    .then(migrateAlertIncidents)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
