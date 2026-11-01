/**
 * ALERT-FR-012, BR-34, BR-16 (TC-F07-02, DF-6) — THRESHOLD_BREACH qua đường nhận telemetry thật:
 * chỉ tạo khi 1 chỉ số ở ngoài ngưỡng liên tục đủ thời gian chờ (10 phút nhiệt độ/độ ẩm, 5 phút
 * ánh sáng/NH3/CO2), mang chi tiết (chỉ số, giá trị, ngưỡng, chiều, lúc bắt đầu), còn sống khi chỉ số
 * vẫn ngoài ngưỡng và tự đóng sau 5 phút về trong ngưỡng.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import alertRoutes from '@/routes/alerts.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { resolveStaleThresholdAlerts } from '@/services/alert.service'
import { ingestTelemetry } from '@/services/telemetry.service'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import type { Role, TelemetryPayload } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitAlertNew: jest.fn(), emitDeviceStatusChange: jest.fn(), emitNotificationNew: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  findRecipients: jest.fn().mockResolvedValue([]),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/alerts', alertRoutes)
app.use(errorHandler)

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
  await Promise.all([Alert, SensorNode, Farm, House, Zone, Telemetry, User].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const MIN = 60_000

let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'Chủ', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'CG', role: 'DOMAIN_EXPERT' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Tầng 1' })
  const node = await SensorNode.create({ device_id: `ESP-B${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const t0 = Date.now()
  /** Mẫu sống tại phút `minute` (giây `second`) tính từ t0; `now` đi theo mẫu */
  const at = (minute: number, over: Partial<TelemetryPayload> = {}, second = 0) => {
    const ts = t0 + minute * MIN + second * 1000
    return ingestTelemetry({
      deviceId: node.device_id, timestamp: ts, temperature: 28, humidity: 85, light_lux: 0.1, nh3_ppm: 5, co2_ppm: 800,
      sound_db: 40, relay_states: { misting: false, speaker: false, ventilation: false }, control_mode: 'AUTO', ...over,
    }, ts)
  }
  /** Gửi mẫu mỗi 10 giây từ phút `from` tới hết phút `to` */
  const run = async (from: number, to: number, over: Partial<TelemetryPayload>) => {
    for (let s = from * 60; s <= to * 60; s += 10) await at(0, over, s)
  }
  return { owner, expert, zone, node, t0, at, run }
}

/** raiseThresholdAlert chạy không chờ — đợi các lượt ghi xong */
const settle = () => new Promise(r => setTimeout(r, 150))
const breaches = (zoneId: unknown) => Alert.find({ zone_id: zoneId, type: 'THRESHOLD_BREACH' }).lean()
const LOW_HUMIDITY = { humidity: DEFAULT_THRESHOLDS.humidity_min - 5 }

describe('THRESHOLD_BREACH có thời gian chờ (TC-F07-02)', () => {
  it('độ ẩm thấp hơn humidity_min 5 %RH: 9 phút không có cảnh báo, 10 phút có 1 cảnh báo mang chi tiết', async () => {
    const { zone, t0, run } = await seed()
    await run(0, 9, LOW_HUMIDITY)
    await settle()
    expect(await breaches(zone._id)).toHaveLength(0)

    await run(9.5, 10, LOW_HUMIDITY)
    await settle()
    const [alert, ...rest] = await breaches(zone._id)
    expect(rest).toHaveLength(0)
    expect(alert.severity).toBe('MEDIUM')
    expect(alert.details).toEqual({
      metric: 'humidity', observed: DEFAULT_THRESHOLDS.humidity_min - 5, threshold: DEFAULT_THRESHOLDS.humidity_min,
      direction: 'below', started_at: new Date(t0),
    })
  })

  it('NH3 vượt nh3_max: 4 phút không, 5 phút có — ghi rõ là ngưỡng cảnh báo của zone, không chạy quạt', async () => {
    const { zone, run } = await seed()
    const highNh3 = { nh3_ppm: DEFAULT_THRESHOLDS.nh3_max + 10 }
    await run(0, 4, highNh3)
    await settle()
    expect(await breaches(zone._id)).toHaveLength(0)

    await run(4.5, 5, highNh3)
    await settle()
    const [alert] = await breaches(zone._id)
    expect(alert.details).toMatchObject({ metric: 'nh3_ppm', direction: 'above', threshold: DEFAULT_THRESHOLDS.nh3_max })
    expect(alert.message).toContain('không tự chạy quạt')
  })

  it('1 mẫu trong ngưỡng xen giữa → phải chờ đủ 10 phút kể từ sau mẫu đó', async () => {
    const { zone, run, at } = await seed()
    await run(0, 6, LOW_HUMIDITY)
    await at(6, {}, 5) // về trong ngưỡng 1 mẫu
    await run(6.5, 16, LOW_HUMIDITY)
    await settle()
    expect(await breaches(zone._id)).toHaveLength(0)

    await run(16.5, 17, LOW_HUMIDITY)
    await settle()
    expect(await breaches(zone._id)).toHaveLength(1)
  })

  it('số đo độ ẩm thiếu giữa chừng không cắt quãng chờ và không được tính là vượt ngưỡng', async () => {
    const { zone, run } = await seed()
    await run(0, 4, LOW_HUMIDITY)
    await run(4.5, 6, { humidity: undefined })
    await run(6.5, 10, LOW_HUMIDITY)
    await settle()
    expect(await breaches(zone._id)).toHaveLength(1)

    const other = await seed()
    await other.run(0, 15, { humidity: undefined })
    await settle()
    expect(await breaches(other.zone._id)).toHaveLength(0)
  })

  it('thiết bị im lặng 58 phút rồi gửi lại vẫn thấp: không bắn ngay, đếm lại 10 phút từ mẫu mới', async () => {
    const { zone, t0, run } = await seed()
    await run(0, 2, LOW_HUMIDITY)
    await run(60, 69.5, LOW_HUMIDITY)
    await settle()
    expect(await breaches(zone._id)).toHaveLength(0)

    await run(69.5 + 1 / 6, 70, LOW_HUMIDITY)
    await settle()
    const [alert] = await breaches(zone._id)
    expect(alert.details).toMatchObject({ metric: 'humidity', started_at: new Date(t0 + 60 * MIN) })
  })

  it('mẫu buffer offline cũ vượt ngưỡng không tạo cảnh báo', async () => {
    const { zone, node } = await seed()
    const twoHoursAgo = Date.now() - 2 * 60 * MIN
    for (let s = 0; s <= 900; s += 10) {
      await ingestTelemetry({
        deviceId: node.device_id, timestamp: twoHoursAgo + s * 1000, temperature: 28, ...LOW_HUMIDITY, light_lux: 0.1,
        nh3_ppm: 5, co2_ppm: 800, sound_db: 40, relay_states: { misting: false, speaker: false, ventilation: false }, control_mode: 'AUTO',
      })
    }
    await settle()
    expect(await breaches(zone._id)).toHaveLength(0)
  })
})

describe('tự đóng (BR-16)', () => {
  it('chỉ số còn ngoài ngưỡng (kể cả chưa đủ thời gian chờ) thì cảnh báo không đóng; về trong ngưỡng 5 phút thì RESOLVED', async () => {
    const { zone, run, at } = await seed()
    await run(0, 10, LOW_HUMIDITY)
    await settle()
    const [alert] = await breaches(zone._id)

    // 1 mẫu trong ngưỡng rồi lại ra ngoài: quãng chờ mới chưa đủ, nhưng cảnh báo đang mở vẫn được
    // gia hạn (mô phỏng lần thấy cuối đã 2 phút trước), chưa coi là "về trong ngưỡng 5 phút"
    await Alert.updateOne({ _id: alert._id }, { last_seen_at: new Date(Date.now() - 2 * MIN) })
    await at(10, {}, 5)
    await run(10.5, 11, LOW_HUMIDITY)
    await settle()
    expect(await resolveStaleThresholdAlerts(new Date(Date.now() + 4 * MIN))).toBe(0)

    // Không còn mẫu ngoài ngưỡng: 5 phút sau thì đóng
    expect(await resolveStaleThresholdAlerts(new Date(Date.now() + 6 * MIN))).toBe(1)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('cảnh báo độ ẩm không được giữ sống bởi nhiệt độ vừa vượt (chưa đủ thời gian chờ)', async () => {
    const { zone, run } = await seed()
    await run(0, 10, LOW_HUMIDITY)
    await settle()
    const [alert] = await breaches(zone._id)
    expect(alert.metadata).toMatchObject({ metrics: ['humidity'] })

    await Alert.updateOne({ _id: alert._id }, { last_seen_at: new Date(Date.now() - 2 * MIN) })
    await run(10 + 1 / 6, 11, { temperature: DEFAULT_THRESHOLDS.temp_max + 2 })
    await settle()
    expect(await resolveStaleThresholdAlerts(new Date(Date.now() + 4 * MIN))).toBe(1)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('Farm Owner và Domain Expert đều thấy cảnh báo', async () => {
    const { owner, expert, zone, run } = await seed()
    await run(0, 10, LOW_HUMIDITY)
    await settle()
    for (const [id, role] of [[owner._id, 'FARM_OWNER'], [expert._id, 'DOMAIN_EXPERT']] as const) {
      const res = await request(app).get(`/alerts?zoneId=${zone._id}&type=THRESHOLD_BREACH`)
        .set('Authorization', `Bearer ${tokenFor(id, role)}`).expect(200)
      expect(res.body.meta.total).toBe(1)
      expect(res.body.data[0].details.metric).toBe('humidity')
    }
  })
})
