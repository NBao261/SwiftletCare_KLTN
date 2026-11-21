/**
 * migrate-zone-reports (G-32, quyết định Q-08) — báo cáo tuần theo Zone cũ (`zonehealthreports`, không còn sinh từ
 * 18/11/2026) vào báo cáo nhà `WEEKLY` cùng kỳ (EXPERT-FR-005), như Report 4 §6.4 đã thiết kế:
 *
 * - kỳ của báo cáo Zone (`period_start` … `period_end`, hết trước `period_end`) quy ra ngày giờ VN;
 * - báo cáo nhà cùng nhà và cùng kỳ đã có thì giữ nguyên số liệu, chưa có thì sinh bằng `generateHouseReport` từ dữ liệu
 *   còn lưu (một phần cho mỗi Zone của nhà);
 * - kết luận của chuyên gia (EXPERT-FR-006, BR-36: giữ suốt đời cài đặt) chép sang báo cáo nhà, mở đầu bằng tên Zone;
 *   báo cáo nhà đã có kết luận thì nối thêm, không ghi đè;
 * - báo cáo Zone đã chuyển được đánh dấu `migrated_to`, nên chạy lại không chép lần hai; khi mọi bản đã chuyển thì xoá
 *   collection, vì code không còn đọc nó.
 *
 * Chạy: npm run migrate:zone-reports   (chạy lại nhiều lần vẫn an toàn)
 */
import 'dotenv/config'
import mongoose, { Types } from 'mongoose'
import { connectDB } from '@/config/db.config'
import { HouseHealthReport } from '@/models/houseHealthReport.model'
import { vnDate } from '@/services/birdCount.service'
import { generateHouseReport } from '@/services/houseHealthReport.service'
import logger from '@/utils/logger.util'

interface StoredZoneReport {
  _id: Types.ObjectId
  zone_id: Types.ObjectId
  period_start: Date
  period_end: Date
  expert_conclusion?: { text: string; by: Types.ObjectId; at: Date; edited_at?: Date }
  migrated_to?: Types.ObjectId
}

export async function migrateZoneReports(now = new Date()): Promise<{ migrated: number; skipped: number; dropped: boolean }> {
  const db = mongoose.connection.db!
  const exists = (await db.listCollections({ name: 'zonehealthreports' }).toArray()).length > 0
  if (!exists) return { migrated: 0, skipped: 0, dropped: false }
  const zoneReports = db.collection<StoredZoneReport>('zonehealthreports')
  // Đọc thẳng collection: Zone hoặc nhà đã xoá mềm vẫn phải tìm ra được
  const zones = db.collection<{ _id: Types.ObjectId; house_id: Types.ObjectId; name: string }>('zones')

  let migrated = 0
  let skipped = 0
  for (const old of await zoneReports.find({ migrated_to: { $exists: false } }).toArray()) {
    const zone = await zones.findOne({ _id: old.zone_id })
    if (!zone) { skipped++; continue }
    const from = vnDate(old.period_start)
    const to = vnDate(new Date(old.period_end.getTime() - 1))
    const houseId = String(zone.house_id)

    const existing = await HouseHealthReport.findOne({ house_id: zone.house_id, kind: 'WEEKLY', period_start: from, period_end: to })
    const report = existing ?? (await generateHouseReport('WEEKLY', houseId, from, to, now))?.report
    if (!report) { skipped++; continue }

    if (old.expert_conclusion) {
      const text = `${zone.name}: ${old.expert_conclusion.text}`
      if (!report.expert_conclusion) {
        report.expert_conclusion = { ...old.expert_conclusion, text }
      } else if (!report.expert_conclusion.text.includes(text)) {
        report.expert_conclusion.text = `${report.expert_conclusion.text}\n\n${text}`
        report.expert_conclusion.edited_at = old.expert_conclusion.edited_at ?? old.expert_conclusion.at
      }
      report.markModified('expert_conclusion')
      await report.save()
    }
    await zoneReports.updateOne({ _id: old._id }, { $set: { migrated_to: report._id } })
    migrated++
  }

  const left = await zoneReports.countDocuments({ migrated_to: { $exists: false } })
  if (left === 0) await zoneReports.drop()
  logger.info(`[migrate] báo cáo Zone: chuyển ${migrated}, bỏ qua ${skipped} (Zone hoặc nhà không còn), còn lại ${left}`)
  return { migrated, skipped, dropped: left === 0 }
}

if (require.main === module) {
  connectDB()
    .then(() => migrateZoneReports())
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
