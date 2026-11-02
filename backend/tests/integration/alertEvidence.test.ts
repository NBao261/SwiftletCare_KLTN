/**
 * ALERT-FR-014, EXPERT-FR-003 — `GET /alerts/:id/evidence`: dữ liệu nhiều nguồn quanh 1 cảnh báo suy
 * luận (±30 phút, hoặc ngày của phiên cho LOW_RETURN_RATE), nguồn trống báo `missing` chứ không phải 0,
 * kèm các kết luận trước cùng loại cùng nơi. Hệ thống chỉ trình bày, không kết luận.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import alertRoutes from '@/routes/alerts.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import type { AlertType, Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn() }))

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
  await Promise.all([Alert, BirdCountBucket, CameraNode, SensorNode, Farm, House, Zone, Telemetry, User]
    .map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const MIN = 60_000
const AT = new Date('2026-10-20T03:00:00Z') // 10:00 giờ Việt Nam

let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'Chủ', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'Chuyên gia', role: 'DOMAIN_EXPERT' })
  const technician = await User.create({ email: `t${seq}@test.vn`, password_hash: 'password123', full_name: 'KTV', role: 'TECHNICIAN' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Tầng 1' })
  const node = await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const camera = await CameraNode.create({ device_id: `cam_${seq}`, house_id: house._id, status: 'ONLINE' })
  const mkAlert = (type: AlertType, extra: object = {}) => Alert.create({
    farm_id: farm._id, zone_id: zone._id, type, severity: 'MEDIUM', title: 't', message: 'm', created_at: AT, ...extra,
  })
  const get = (id: unknown, token = tokenFor(expert._id, 'DOMAIN_EXPERT')) =>
    request(app).get(`/alerts/${id}/evidence`).set('Authorization', `Bearer ${token}`)
  return { owner, expert, technician, farm, house, zone, node, camera, mkAlert, get }
}

describe('GET /alerts/:id/evidence — cảnh báo theo zone (±30 phút)', () => {
  it('trả telemetry và số đếm trong cửa sổ, cảnh báo thiết bị đang mở của zone, kết luận trước cùng loại', async () => {
    const { zone, house, node, camera, mkAlert, get } = await seed()
    const alert = await mkAlert('NOISE_ANOMALY')
    await Telemetry.create([
      { node_id: node._id, zone_id: zone._id, timestamp: new Date(AT.getTime() - 10 * MIN), temperature: 29, humidity: 82, sound_db: 60 },
      { node_id: node._id, zone_id: zone._id, timestamp: new Date(AT.getTime() + 10 * MIN), temperature: 30, humidity: 80, sound_db: 75 },
      { node_id: node._id, zone_id: zone._id, timestamp: new Date(AT.getTime() + 40 * MIN), temperature: 31, humidity: 79 }, // ngoài cửa sổ
    ])
    await BirdCountBucket.create({ camera_node_id: camera._id, house_id: house._id, bucket_start: new Date(AT.getTime() - 5 * MIN), entry_count: 3, exit_count: 12 })
    await mkAlert('SENSOR_FAULT', { node_id: node._id })
    await mkAlert('RS485_BUS_FAILURE', { node_id: node._id, status: 'RESOLVED' }) // đã đóng — không kèm
    const earlier = await mkAlert('NOISE_ANOMALY', {
      created_at: new Date(AT.getTime() - 3 * 86_400_000),
      expert_verdict: { result: 'REJECTED', note: 'Tiếng mưa', by: node._id, at: new Date() },
    })

    const res = await get(alert._id).expect(200)
    const data = res.body.data
    expect(data.window).toEqual({ from: new Date(AT.getTime() - 30 * MIN).toISOString(), to: new Date(AT.getTime() + 30 * MIN).toISOString() })
    expect(data.telemetry.status).toBe('ok')
    expect(data.telemetry.samples.map((s: { sound_db: number }) => s.sound_db)).toEqual([60, 75])
    expect(data.bird_counts).toEqual({ status: 'ok', buckets: [expect.objectContaining({ entry_count: 3, exit_count: 12 })] })
    expect(data.device_alerts.map((a: { type: string }) => a.type)).toEqual(['SENSOR_FAULT'])
    expect(data.earlier_verdicts.map((a: { _id: string }) => a._id)).toEqual([String(earlier._id)])
  })

  it('nguồn không có dữ liệu trong cửa sổ báo missing, không phải 0', async () => {
    const { mkAlert, get } = await seed()
    const alert = await mkAlert('SENSOR_ANOMALY')
    const { data } = (await get(alert._id).expect(200)).body
    expect(data.telemetry).toEqual({ status: 'missing', samples: [] })
    expect(data.bird_counts).toEqual({ status: 'missing', buckets: [] })
  })
})

describe('GET /alerts/:id/evidence — LOW_RETURN_RATE (ngày của phiên)', () => {
  it('% thời gian trong ngưỡng từng zone của nhà, tiếng ồn và cảnh báo thiết bị của nhà trong ngày', async () => {
    const { farm, house, zone, node, mkAlert, get } = await seed()
    const zone2 = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Tầng 2' }) // không có dữ liệu
    const alert = await Alert.create({
      farm_id: farm._id, house_id: house._id, type: 'LOW_RETURN_RATE', severity: 'LOW', title: 't', message: 'm',
      metadata: { sessionDate: '2026-10-20' }, created_at: new Date('2026-10-20T12:30:00Z'),
    })
    // Ngưỡng mặc định: nhiệt độ 26–31, độ ẩm 75–95 → 3/4 mẫu nhiệt độ, 2/4 mẫu độ ẩm trong ngưỡng
    await Telemetry.create([
      { temperature: 28, humidity: 80 }, { temperature: 29, humidity: 70 }, { temperature: 30, humidity: 85 }, { temperature: 33, humidity: 60 },
    ].map((v, i) => ({ node_id: node._id, zone_id: zone._id, timestamp: new Date(AT.getTime() + i * MIN), ...v })))
    await mkAlert('NOISE_ANOMALY')
    await mkAlert('NOISE_ANOMALY', { created_at: new Date('2026-10-18T03:00:00Z') }) // ngày khác
    await mkAlert('SPEAKER_FAILURE', { node_id: node._id })

    const { data } = (await get(alert._id).expect(200)).body
    expect(data.window).toEqual({ from: '2026-10-19T17:00:00.000Z', to: '2026-10-20T17:00:00.000Z' })
    const byZone = Object.fromEntries(data.zones_in_range.map((z: { zone_id: string }) => [z.zone_id, z]))
    expect(byZone[String(zone._id)]).toMatchObject({ status: 'ok', temp_in_range_pct: 75, humidity_in_range_pct: 50 })
    expect(byZone[String(zone2._id)]).toMatchObject({ status: 'missing', temp_in_range_pct: null, humidity_in_range_pct: null })
    expect(data.noise_alerts).toHaveLength(1)
    expect(data.device_alerts.map((a: { type: string }) => a.type)).toEqual(['SPEAKER_FAILURE'])
  })
})

describe('GET /alerts/:id/evidence — quyền và loại cảnh báo', () => {
  it('cảnh báo đo trực tiếp → 400; farm khác, Technician → 403; Farm Owner của farm đọc được', async () => {
    const { owner, technician, mkAlert, get } = await seed()
    const direct = await mkAlert('THRESHOLD_BREACH')
    await get(direct._id).expect(400)

    const inferred = await mkAlert('NOISE_ANOMALY')
    await get(inferred._id, tokenFor(owner._id, 'FARM_OWNER')).expect(200)
    await get(inferred._id, tokenFor(technician._id, 'TECHNICIAN')).expect(403)
    const other = await seed()
    await get(inferred._id, tokenFor(other.expert._id, 'DOMAIN_EXPERT')).expect(403)
  })
})
