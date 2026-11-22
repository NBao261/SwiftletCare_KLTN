// Drop tickets, ticketmessages, maintenanceschedules; gỡ sla_hours, max_open_tickets_per_technician. Chạy lại an toàn
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
