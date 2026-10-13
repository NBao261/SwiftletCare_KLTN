/**
 * Các lỗi tìm thấy khi review PR 59 — mỗi test giữ cho lỗi đó không quay lại:
 * - ảnh chụp môi trường/đàn chim của mẻ thu hoạch luôn rỗng (zone_id dạng chuỗi trong aggregate)
 * - xoá tài khoản không xoá liên kết Telegram
 * - ghi lịch sử can thiệp tay lỗi thì lệnh relay không được gửi
 * - lịch sử hết hạn ghi giờ chạy job thay vì hạn override
 * - cảnh báo theo đợt không bao giờ đóng nên mọi lần tái phát bị dedup nuốt
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import deviceRoutes from '@/routes/devices.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { House, Zone } from '@/models/houseZone.model'
import { RelayOverrideLog } from '@/models/relayOverrideLog.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { publishCommand } from '@/mqtt/mqtt.client'
import { completeDeletionRequest } from '@/services/admin.service'
import { EPISODE_CLEAR_MS, ingestDeviceAlert, resolveStaleEpisodeAlerts } from '@/services/alert.service'
import { expireManualOverrides } from '@/services/device.service'
import { createHarvest } from '@/services/harvest.service'
import type { CurrentUser } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
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
  jest.restoreAllMocks()
  jest.clearAllMocks()
  await Promise.all([
    Alert, AuditLog, BirdCountRecord, SensorNode, Farm, HarvestBatch, House, Zone, RelayOverrideLog, Telemetry, User,
  ].map(m => (m as typeof User).deleteMany({ is_deleted: { $in: [true, false, null] } })))
})

const DAY = 86400_000
let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  const node = await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  const user: CurrentUser = { _id: String(owner._id), email: owner.email, role: 'FARM_OWNER' }
  return { owner, user, farm, zone, node, token, relay: `/devices/sensor-nodes/${node._id}` }
}

describe('ảnh chụp của mẻ thu hoạch (MARKET-FR-002/003)', () => {
  it('lấy được trung bình môi trường 7 ngày và tỷ lệ chim về 30 ngày của đúng Zone', async () => {
    const { user, zone, node } = await seed()
    const other = await seed()
    const now = Date.now()
    const sample = (zoneId: unknown, nodeId: unknown, agoMs: number, temperature: number, humidity: number) =>
      ({ zone_id: zoneId, node_id: nodeId, timestamp: new Date(now - agoMs), temperature, humidity, nh3_ppm: 6, co2_ppm: 800, light_lux: 0.1 })
    await Telemetry.insertMany([
      sample(zone._id, node._id, 6.5 * DAY, 28, 80), sample(zone._id, node._id, 3 * DAY, 30, 84), sample(zone._id, node._id, 60_000, 29, 82),
      sample(other.zone._id, other.node._id, DAY, 40, 10), // Zone khác — không được lẫn vào
    ])
    await BirdCountRecord.create([
      { camera_node_id: new mongoose.Types.ObjectId(), zone_id: zone._id, timestamp: new Date(now - 2 * DAY), session_type: 'EVENING_ENTRY', entry_count: 120, return_rate: 90 },
      { camera_node_id: new mongoose.Types.ObjectId(), zone_id: zone._id, timestamp: new Date(now - DAY), session_type: 'EVENING_ENTRY', entry_count: 100, return_rate: 80 },
    ])

    const batch = await createHarvest(user, {
      zone_id: String(zone._id), harvest_date: new Date(now).toISOString(), nest_count: 10, weight_grams: 100, nest_type: 'RAW',
    })

    expect(batch.toObject().env_snapshot).toMatchObject({ avg_temperature: 29, avg_humidity: 82, avg_nh3_ppm: 6, insufficient_data: false })
    expect(batch.toObject().flock_snapshot).toMatchObject({ avg_return_rate_30d: 85, estimated_population: 120 })
  })
})

describe('xoá tài khoản (AUTH-FR-012, PRIV-NFR-003)', () => {
  it('xoá luôn chat id và mã liên kết Telegram', async () => {
    const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'A', role: 'ADMIN' })
    const user = await User.create({
      email: 'gone@test.vn', password_hash: 'password123', full_name: 'Gone', role: 'DOMAIN_EXPERT',
      telegram_chat_id: '123456', telegram_link_code_hash: 'abc', telegram_link_expires_at: new Date(Date.now() + 60_000),
      deletion_requested_at: new Date(),
    })

    await completeDeletionRequest(String(admin._id), String(user._id), {})

    const after = (await User.findById(user._id).select('+telegram_link_code_hash +telegram_link_expires_at'))!
    expect(after.email).toContain('deleted-')
    expect(after.telegram_chat_id).toBeUndefined()
    expect(after.telegram_link_code_hash).toBeUndefined()
    expect(after.telegram_link_expires_at).toBeUndefined()
  })
})

describe('lịch sử can thiệp tay không được chặn lệnh điều khiển (ENV-FR-019)', () => {
  it('ghi lịch sử lỗi: relay vẫn nhận lệnh và API vẫn trả 200', async () => {
    const { relay, token } = await seed()
    jest.spyOn(RelayOverrideLog, 'create').mockRejectedValue(new Error('db down') as never)

    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    expect(publishCommand).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 'relay/command',
      expect.objectContaining({ relayName: 'misting', state: true }))
  })

  it('đóng lịch sử lỗi: thiết bị vẫn nhận clear_override', async () => {
    const { relay, token } = await seed()
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    jest.clearAllMocks()
    jest.spyOn(RelayOverrideLog, 'updateMany').mockRejectedValue(new Error('db down') as never)

    await request(app).delete(`${relay}/relay-override`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(publishCommand).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 'relay/command',
      expect.objectContaining({ action: 'clear_override' }))
  })

  it('override hết hạn: lịch sử đóng tại đúng hạn, không phải lúc job chạy', async () => {
    const { node, relay, token } = await seed()
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    const expiry = new Date(Date.now() - 45_000) // job chạy trễ 45 giây sau hạn
    await SensorNode.updateOne({ _id: node._id }, { override_expiry: expiry })

    expect(await expireManualOverrides()).toBe(1)
    const log = (await RelayOverrideLog.findOne().lean())!
    expect(log.end_reason).toBe('EXPIRED')
    expect(log.ended_at!.getTime()).toBe(expiry.getTime())
  })
})

describe('cảnh báo theo đợt tự đóng để lần tái phát không bị nuốt (ALERT-FR-008, EXPERT-FR-003)', () => {
  it('NOISE_ANOMALY/PUMP_DRY không tái phát 60 phút thì đóng; lần sau là cảnh báo mới', async () => {
    const { node } = await seed()
    const noise = () => ingestDeviceAlert({ deviceId: node.device_id, type: 'NOISE_ANOMALY', message: 'ồn' })

    expect(await noise()).not.toBeNull()
    expect(await noise()).toBeNull() // cùng đợt: dedup
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'PUMP_DRY', message: 'khô' })
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'SPEAKER_FAILURE', severity: 'HIGH', message: 'loa' })

    expect(await resolveStaleEpisodeAlerts()).toBe(0) // vừa ghi nhận xong — chưa đóng
    const later = new Date(Date.now() + EPISODE_CLEAR_MS + 60_000)
    expect(await resolveStaleEpisodeAlerts(later)).toBe(2)
    expect(await Alert.countDocuments({ status: 'RESOLVED', type: { $in: ['NOISE_ANOMALY', 'PUMP_DRY'] } })).toBe(2)
    // Lỗi phần cứng không có tín hiệu hết thì không tự đóng theo thời gian
    expect((await Alert.findOne({ type: 'SPEAKER_FAILURE' }).lean())!.status).toBe('ACTIVE')

    expect(await noise()).not.toBeNull() // đợt mới → bản ghi mới, được thông báo và kiểm chứng riêng
    expect(await Alert.countDocuments({ type: 'NOISE_ANOMALY' })).toBe(2)
  })

  it('đợt đã được chuyên gia kiểm chứng vẫn giữ kết quả sau khi tự đóng', async () => {
    const { owner, node } = await seed()
    const alert = (await ingestDeviceAlert({ deviceId: node.device_id, type: 'NOISE_ANOMALY', message: 'ồn' }))!
    await Alert.updateOne({ _id: alert._id }, { expert_verdict: { result: 'REJECTED', by: owner._id, at: new Date() } })

    await resolveStaleEpisodeAlerts(new Date(Date.now() + EPISODE_CLEAR_MS + 60_000))
    const after = (await Alert.findById(alert._id).lean())!
    expect(after.status).toBe('RESOLVED')
    expect(after.expert_verdict!.result).toBe('REJECTED')
  })
})
