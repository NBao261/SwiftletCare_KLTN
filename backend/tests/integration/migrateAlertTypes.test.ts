/**
 * migrate-alert-types (G-01): tên cảnh báo cũ đổi sang tên SRS 3.1.0, cảnh báo predator bị xoá,
 * trạng thái thiết bị/mẻ thu hoạch không còn dùng được quy về giá trị hợp lệ, tuỳ chọn Zalo/SMS và
 * sla_hours bị gỡ; dữ liệu khác giữ nguyên; chạy lại không đổi gì.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { migrateAlertTypes } from '@/scripts/migrate-alert-types.script'

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

describe('migrateAlertTypes', () => {
  it('moves stored data to the SRS 3.1.0 enumerations and is safe to re-run', async () => {
    await db().collection('alerts').insertMany([
      { type: 'PUMP_DRY', status: 'ACTIVE' },
      { type: 'POWER_OUTAGE', status: 'RESOLVED' },
      { type: 'PREDATOR_DETECTED', status: 'ACTIVE' },
      { type: 'NODE_OFFLINE', status: 'ACTIVE' },
    ])
    await db().collection('sensornodes').insertMany([
      { device_id: 'a', status: 'DEGRADED', relay_states: { misting: true, fan: false, speaker: false, heating: true } },
      { device_id: 'b', status: 'OFFLINE', relay_states: { misting: false, fan: true, speaker: false } },
    ])
    await db().collection('cameranodes').insertOne({ device_id: 'cam', status: 'ERROR' })
    await db().collection('harvestbatches').insertMany([{ status: 'ARCHIVED' }, { status: 'DRAFT' }])
    await db().collection('users').insertOne({
      email: 'u@x.vn',
      notification_preferences: { push: true, telegram: true, zalo: true, sms: false, quiet_hours: { start: '22:00', end: '06:00' } },
    })
    await db().collection('systemsettings').insertOne({ _singleton: true, default_thresholds: { temp_min: 26 }, sla_hours: { P1: {} } })

    await expect(migrateAlertTypes()).resolves.toEqual({
      alertsRenamed: 2, predatorAlertsDeleted: 1, devicesOnline: 2, heatingRemoved: 1, harvests: 1, users: 1, settings: 1,
    })

    const types = (await db().collection('alerts').find().sort({ _id: 1 }).toArray()).map(a => a.type)
    expect(types).toEqual(['MISTING_INEFFECTIVE', 'UNEXPECTED_RESTART', 'NODE_OFFLINE'])

    const nodeA = await db().collection('sensornodes').findOne({ device_id: 'a' })
    expect(nodeA?.status).toBe('ONLINE')
    expect(nodeA?.relay_states).toEqual({ misting: true, fan: false, speaker: false })
    expect((await db().collection('sensornodes').findOne({ device_id: 'b' }))?.status).toBe('OFFLINE')
    expect((await db().collection('cameranodes').findOne({ device_id: 'cam' }))?.status).toBe('ONLINE')

    const harvestStatuses = (await db().collection('harvestbatches').find().toArray()).map(h => h.status)
    expect(harvestStatuses).toEqual(['DRAFT', 'DRAFT'])

    const user = await db().collection('users').findOne({ email: 'u@x.vn' })
    expect(user?.notification_preferences).toEqual({ push: true, telegram: true, quiet_hours: { start: '22:00', end: '06:00' } })

    const setting = await db().collection('systemsettings').findOne({ _singleton: true })
    expect(setting).not.toHaveProperty('sla_hours')
    expect(setting?.default_thresholds).toEqual({ temp_min: 26 })

    await expect(migrateAlertTypes()).resolves.toEqual({
      alertsRenamed: 0, predatorAlertsDeleted: 0, devicesOnline: 0, heatingRemoved: 0, harvests: 0, users: 0, settings: 0,
    })
  })
})
