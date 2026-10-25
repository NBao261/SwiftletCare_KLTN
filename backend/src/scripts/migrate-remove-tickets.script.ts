/**
 * migrate-remove-tickets.ts — dọn dữ liệu sau khi gỡ module ticket (Report 3 §8, BM03
 * dòng 9): không còn ticket, chat ticket, SLA, gán ticket hay lịch bảo trì định kỳ.
 * Cảnh báo chưa ai xác nhận được gửi lại (ALERT-FR-015), bảo trì bơm/quạt thành
 * cảnh báo MAINTENANCE_DUE (ALERT-FR-016).
 *
 * Chạy: npm run migrate:remove-tickets   (chạy lại nhiều lần vẫn an toàn)
 *
 * 1. Drop collection `tickets`, `ticketmessages`, `maintenanceschedules` nếu còn.
 * 2. `systemsettings`: gỡ `sla_hours`, `max_open_tickets_per_technician`.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import logger from '@/utils/logger.util'

const TICKET_COLLECTIONS = ['tickets', 'ticketmessages', 'maintenanceschedules']

export async function migrateRemoveTickets() {
  const db = mongoose.connection.db!
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name))
  const dropped: string[] = []
  for (const name of TICKET_COLLECTIONS) {
    if (!existing.has(name)) continue
    await db.dropCollection(name)
    dropped.push(name)
    logger.info(`[migrate] Drop collection ${name}`)
  }

  const settings = await db.collection('systemsettings').updateMany(
    { $or: [{ sla_hours: { $exists: true } }, { max_open_tickets_per_technician: { $exists: true } }] },
    { $unset: { sla_hours: '', max_open_tickets_per_technician: '' } },
  )
  logger.info(`[migrate] Gỡ cấu hình SLA/gán ticket ở ${settings.modifiedCount} system setting`)

  return { dropped, settingsUpdated: settings.modifiedCount }
}

if (require.main === module) {
  connectDB()
    .then(migrateRemoveTickets)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
