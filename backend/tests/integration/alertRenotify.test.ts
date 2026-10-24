/**
 * ALERT-FR-015 — cảnh báo chưa ai xác nhận được gửi lại đúng 1 lần cho Farm Owner
 * (CRITICAL/HIGH sau 15 phút, NODE_OFFLINE sau 1 giờ), thay ticket leo thang cũ.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { renotifyStaleAlerts } from '@/services/alert.service'
import { dispatchAlertNotification } from '@/services/notification.service'
import type { AlertSeverity, AlertStatus, AlertType } from '@/types'

jest.mock('@/socket', () => ({ emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn() }))
jest.mock('@/services/notification.service', () => ({
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
}))

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
afterEach(async () => {
  jest.clearAllMocks()
  await Promise.all([Alert, SensorNode, Farm, House, Zone, User].map(m => (m as typeof Alert).deleteMany({})))
})

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

async function seed(nodeStatus: 'ONLINE' | 'OFFLINE' = 'OFFLINE') {
  const owner = await User.create({ email: 'o@test.vn', password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  const node = await SensorNode.create({ device_id: 'ESP-1', zone_id: zone._id, status: nodeStatus })
  const alert = (type: AlertType, severity: AlertSeverity, created_at: Date, status: AlertStatus = 'ACTIVE') => Alert.create({
    farm_id: farm._id, zone_id: zone._id, node_id: node._id, type, severity, title: 't', message: 'm', status, created_at,
  })
  return { node, alert }
}

describe('renotifyStaleAlerts (ALERT-FR-015)', () => {
  it('gửi lại CRITICAL chưa xác nhận sau 15 phút đúng 1 lần, không lần thứ ba', async () => {
    const { alert } = await seed()
    const a = await alert('RS485_BUS_FAILURE', 'CRITICAL', minutesAgo(10))
    expect(await renotifyStaleAlerts()).toBe(0)

    await Alert.collection.updateOne({ _id: a._id }, { $set: { created_at: minutesAgo(20) } })
    expect(await renotifyStaleAlerts()).toBe(1)
    expect(dispatchAlertNotification).toHaveBeenCalledWith(expect.objectContaining({ _id: a._id }), { repeat: true })
    expect((await Alert.findById(a._id).lean())!.renotified_at).toBeInstanceOf(Date)

    expect(await renotifyStaleAlerts()).toBe(0)
    expect(dispatchAlertNotification).toHaveBeenCalledTimes(1)
  })

  it('không gửi lại cảnh báo đã xác nhận hoặc đã đóng', async () => {
    const { alert } = await seed()
    await alert('POWER_OUTAGE', 'HIGH', minutesAgo(20), 'ACKNOWLEDGED')
    await alert('SPEAKER_FAILURE', 'HIGH', minutesAgo(20), 'RESOLVED')
    expect(await renotifyStaleAlerts()).toBe(0)
  })

  it('không bao giờ gửi lại MEDIUM, LOW', async () => {
    const { alert } = await seed()
    await alert('SENSOR_FAULT', 'MEDIUM', minutesAgo(120))
    await alert('MAINTENANCE_DUE', 'LOW', minutesAgo(120))
    expect(await renotifyStaleAlerts()).toBe(0)
  })

  it('NODE_OFFLINE chỉ gửi lại sau 1 giờ, 1 lần', async () => {
    const { alert } = await seed()
    const a = await alert('NODE_OFFLINE', 'HIGH', minutesAgo(30))
    expect(await renotifyStaleAlerts()).toBe(0)

    await Alert.collection.updateOne({ _id: a._id }, { $set: { created_at: minutesAgo(70) } })
    expect(await renotifyStaleAlerts()).toBe(1)
    expect(await renotifyStaleAlerts()).toBe(0)
  })

  it('bỏ qua NODE_OFFLINE của thiết bị đã ONLINE lại (cảnh báo chỉ chưa kịp đóng)', async () => {
    const { alert } = await seed('ONLINE')
    await alert('NODE_OFFLINE', 'HIGH', minutesAgo(120))
    expect(await renotifyStaleAlerts()).toBe(0)
  })

  it('bỏ qua cảnh báo của thiết bị đã gỡ', async () => {
    const { node, alert } = await seed()
    await SensorNode.updateOne({ _id: node._id }, { decommissioned_at: new Date() })
    await alert('POWER_OUTAGE', 'HIGH', minutesAgo(20))
    expect(await renotifyStaleAlerts()).toBe(0)
  })
})
