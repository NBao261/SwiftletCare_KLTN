/**
 * ALERT-FR-010 — quét cảm biến bất thường tạo SENSOR_ANOMALY mức MEDIUM (không bị
 * alertEscalation tự sinh ticket) và tự đóng khi dữ liệu bình thường trở lại.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { scanSensorAnomalies } from '@/services/sensorAnomaly.service'
import { createTicketsFromStaleAlerts } from '@/services/ticket.service'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn() }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined), notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
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
  await Promise.all([Alert, SensorNode, Farm, House, Zone, Telemetry, Ticket, User].map(m => (m as typeof Alert).deleteMany({})))
})

async function seed() {
  const owner = await User.create({ email: 'anomaly@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', owner_id: owner._id })
  const house = await House.create({ farm_id: farm._id, name: 'House' })
  const zone = await Zone.create({ house_id: house._id, name: 'Zone A' })
  const node = await SensorNode.create({ device_id: 'ESP32-AN-1', zone_id: zone._id, status: 'ONLINE' })
  return { zone, node }
}

async function writeSamples(nodeId: unknown, zoneId: unknown, now: number, humidity: (i: number) => number) {
  await Telemetry.insertMany(Array.from({ length: 780 }, (_, i) => ({
    node_id: nodeId, zone_id: zoneId, timestamp: new Date(now - (779 - i) * 10_000),
    humidity: humidity(i), temperature: 28 + (i % 5) / 10, co2_ppm: 800,
  })))
}

describe('scanSensorAnomalies', () => {
  it('raises one MEDIUM SENSOR_ANOMALY for a stuck sensor, never escalates it, and resolves it once data is normal', async () => {
    const { zone, node } = await seed()
    const now = Date.now()
    await writeSamples(node._id, zone._id, now, () => 80.3)

    expect(await scanSensorAnomalies(new Date(now))).toEqual({ raised: 1, resolved: 0 })
    const alert = (await Alert.findOne({ type: 'SENSOR_ANOMALY' }).lean())!
    expect(alert.severity).toBe('MEDIUM')
    expect(String(alert.node_id)).toBe(String(node._id))

    // Không ai xác nhận sau 20 phút: vẫn không được tự sinh ticket (chỉ HIGH/CRITICAL)
    // collection.updateOne: bỏ qua Mongoose (created_at là timestamp bất biến)
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: new Date(now - 20 * 60_000) } })
    await createTicketsFromStaleAlerts()
    expect(await Ticket.countDocuments()).toBe(0)

    await Telemetry.deleteMany({})
    await writeSamples(node._id, zone._id, now, i => 80 + (i % 4) / 10)
    expect(await scanSensorAnomalies(new Date(now))).toEqual({ raised: 0, resolved: 1 })
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('stays quiet on healthy data', async () => {
    const { zone, node } = await seed()
    const now = Date.now()
    await writeSamples(node._id, zone._id, now, i => 80 + (i % 4) / 10)

    expect(await scanSensorAnomalies(new Date(now))).toEqual({ raised: 0, resolved: 0 })
  })
})
