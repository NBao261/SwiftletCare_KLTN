/**
 * migrate-remove-tickets: collection ticket/lịch bảo trì bị drop, cấu hình SLA và gán
 * ticket bị gỡ khỏi system setting, ngưỡng mặc định giữ nguyên; chạy lại không lỗi.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { migrateRemoveTickets } from '@/scripts/migrate-remove-tickets.script'

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

const db = () => mongoose.connection.db!
const collectionNames = async () => (await db().listCollections({}, { nameOnly: true }).toArray()).map(c => c.name)

describe('migrateRemoveTickets', () => {
  it('drops the ticket collections, unsets SLA and routing settings, and is safe to re-run', async () => {
    await db().collection('tickets').insertOne({ title: 'x', status: 'NEW' })
    await db().collection('ticketmessages').insertOne({ content: 'x' })
    await db().collection('maintenanceschedules').insertOne({ interval_days: 30 })
    await db().collection('alerts').insertOne({ type: 'NODE_OFFLINE' })
    await db().collection('systemsettings').insertOne({
      _singleton: true,
      default_thresholds: { temp_min: 26 },
      sla_hours: { P1: { response_hours: 1, resolve_hours: 4 } },
      max_open_tickets_per_technician: 10,
    })

    const first = await migrateRemoveTickets()
    expect(first).toEqual({ dropped: ['tickets', 'ticketmessages', 'maintenanceschedules'], settingsUpdated: 1 })
    const names = await collectionNames()
    expect(names).not.toContain('tickets')
    expect(names).not.toContain('ticketmessages')
    expect(names).not.toContain('maintenanceschedules')
    expect(names).toContain('alerts')

    const setting = await db().collection('systemsettings').findOne({ _singleton: true })
    expect(setting).not.toHaveProperty('sla_hours')
    expect(setting).not.toHaveProperty('max_open_tickets_per_technician')
    expect(setting?.default_thresholds).toEqual({ temp_min: 26 })

    await expect(migrateRemoveTickets()).resolves.toEqual({ dropped: [], settingsUpdated: 0 })
  })
})
