/**
 * ENV-FR-019 + ANALYTICS-FR-011 (SRS v2.0.0) — mỗi lần can thiệp tay để lại 1 bản ghi
 * (ai, role, relay, trạng thái, bắt đầu/kết thúc, lý do kết thúc), và tỷ lệ thời gian
 * tự động của Zone tính từ các bản ghi đó.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import analyticsRoutes from '@/routes/analytics.route'
import deviceRoutes from '@/routes/devices.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { RelayOverrideLog } from '@/models/relayOverrideLog.model'
import { User } from '@/models/user.model'
import { confirmRelayStatus, expireManualOverrides } from '@/services/device.service'
import { closeOrphanedOverrideLogs } from '@/services/relayOverrideLog.service'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use('/analytics', analyticsRoutes)
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
  await Promise.all([AuditLog, SensorNode, Farm, House, Zone, RelayOverrideLog, User].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const call = (method: 'get' | 'post' | 'delete', path: string, token: string, body: object = {}) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'Chủ trại', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  const node = await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  return { owner, farm, zone, node, relay: `/devices/sensor-nodes/${node._id}`, t: { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') } }
}

describe('lịch sử can thiệp tay (ENV-FR-019)', () => {
  it('bật tay mở 1 bản ghi; bấm lại cùng relay thì bản cũ REPLACED; tắt sớm thì CLEARED_EARLY', async () => {
    const { owner, farm, zone, node, relay, t } = await seed()

    await call('post', `${relay}/relay`, t.owner, { relayName: 'misting', state: true, durationMs: 600_000 }).expect(200)
    const first = (await RelayOverrideLog.findOne().lean())!
    expect(first).toMatchObject({ relay: 'misting', state: true, started_by_role: 'FARM_OWNER', ended_at: null })
    expect([String(first.node_id), String(first.zone_id), String(first.farm_id), String(first.started_by)])
      .toEqual([String(node._id), String(zone._id), String(farm._id), String(owner._id)])
    expect(first.expires_at.getTime() - first.started_at.getTime()).toBeGreaterThan(590_000)

    await call('post', `${relay}/relay`, t.owner, { relayName: 'misting', state: false }).expect(200)
    await call('post', `${relay}/relay`, t.owner, { relayName: 'ventilation', state: true }).expect(200)
    expect((await RelayOverrideLog.findById(first._id).lean())!.end_reason).toBe('REPLACED')
    expect(await RelayOverrideLog.countDocuments({ ended_at: null })).toBe(2)

    await call('delete', `${relay}/relay-override`, t.owner).expect(200)
    const closed = await RelayOverrideLog.find({ end_reason: 'CLEARED_EARLY' }).lean()
    expect(closed.map(l => l.relay).sort()).toEqual(['misting', 'ventilation'])
    expect(await RelayOverrideLog.countDocuments({ ended_at: null })).toBe(0)
  })

  it('API lịch sử: mới nhất trước, có phân trang và tên người thao tác; Domain Expert xem được', async () => {
    const { relay, t } = await seed()
    await call('post', `${relay}/relay`, t.owner, { relayName: 'misting', state: true }).expect(200)
    await call('post', `${relay}/relay`, t.owner, { relayName: 'speaker', state: true }).expect(200)

    const res = await call('get', `${relay}/relay-overrides?limit=1`, t.expert).expect(200)
    expect(res.body.meta).toMatchObject({ total: 2, page: 1, limit: 1 })
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({ relay: 'speaker', started_by: { full_name: 'Chủ trại' } })

    const other = await seed()
    await call('get', `${other.relay}/relay-overrides`, t.expert).expect(403)
  })

  it('job hết hạn đóng bản ghi với EXPIRED', async () => {
    const { node, relay, t } = await seed()
    await call('post', `${relay}/relay`, t.owner, { relayName: 'misting', state: true }).expect(200)
    await SensorNode.updateOne({ _id: node._id }, { override_expiry: new Date(Date.now() - 1000) })

    expect(await expireManualOverrides()).toBe(1)
    expect((await RelayOverrideLog.findOne().lean())!).toMatchObject({ end_reason: 'EXPIRED' })
    expect((await RelayOverrideLog.findOne().lean())!.ended_at).toBeInstanceOf(Date)
  })

  it('thiết bị tự báo về AUTO: quá hạn là EXPIRED, chưa tới hạn (khởi động lại) là CLEARED_EARLY', async () => {
    const { node, relay, t } = await seed()
    const auto = () => confirmRelayStatus({
      deviceId: node.device_id, relay_states: { misting: false, speaker: false, ventilation: false }, control_mode: 'AUTO',
    })

    await call('post', `${relay}/relay`, t.owner, { relayName: 'misting', state: true }).expect(200)
    // Bản tin AUTO đã trên đường tới từ trước khi thiết bị kịp thực thi lệnh: không được đóng override vừa mở
    await auto()
    expect((await RelayOverrideLog.findOne({ relay: 'misting' }).lean())!.ended_at).toBeNull()

    // Override đã chạy được 1 phút rồi thiết bị mới báo AUTO (khởi động lại) → kết thúc sớm thật
    await RelayOverrideLog.updateOne({ relay: 'misting' }, { started_at: new Date(Date.now() - 60_000) })
    await SensorNode.updateOne({ _id: node._id }, { control_mode: 'MANUAL' })
    await auto()
    expect((await RelayOverrideLog.findOne({ relay: 'misting' }).lean())!.end_reason).toBe('CLEARED_EARLY')

    await call('post', `${relay}/relay`, t.owner, { relayName: 'ventilation', state: true }).expect(200)
    await RelayOverrideLog.updateOne({ relay: 'ventilation' }, { expires_at: new Date(Date.now() - 1000) })
    await auto()
    expect((await RelayOverrideLog.findOne({ relay: 'ventilation' }).lean())!.end_reason).toBe('EXPIRED')
  })
})

describe('bản ghi không bao giờ mở quá hạn của chính nó', () => {
  it('AUTO tới ngay sau khi bật tay rồi thiết bị im lặng: job vẫn đóng bản ghi tại đúng hạn', async () => {
    const { node, relay, t } = await seed()
    await call('post', `${relay}/relay`, t.owner, { relayName: 'misting', state: true, durationMs: 600_000 }).expect(200)
    // Bản tin AUTO đang trên đường: node về AUTO, mất override_expiry, bản ghi còn mới nên bị bỏ qua
    await confirmRelayStatus({ deviceId: node.device_id, relay_states: { misting: false, speaker: false, ventilation: false }, control_mode: 'AUTO' })
    const after = (await SensorNode.findById(node._id))!
    expect(after.control_mode).toBe('AUTO')
    expect((await RelayOverrideLog.findOne().lean())!.ended_at).toBeNull()

    // Chưa tới hạn: job không đụng tới
    expect(await expireManualOverrides()).toBe(0)
    expect((await RelayOverrideLog.findOne().lean())!.ended_at).toBeNull()

    // Quá hạn mà node không còn MANUAL: phải đóng, tại đúng expires_at
    const expiry = new Date(Date.now() - 120_000)
    await RelayOverrideLog.updateOne({}, { expires_at: expiry })
    expect(await expireManualOverrides()).toBe(0)
    const log = (await RelayOverrideLog.findOne().lean())!
    expect(log.end_reason).toBe('EXPIRED')
    expect(log.ended_at!.getTime()).toBe(expiry.getTime())
  })

  it('không đóng bản ghi quá hạn của relay A khi relay B vừa gia hạn chung cho thiết bị', async () => {
    const { node, relay, t } = await seed()
    await call('post', `${relay}/relay`, t.owner, { relayName: 'misting', state: true }).expect(200)
    await RelayOverrideLog.updateOne({ relay: 'misting' }, { expires_at: new Date(Date.now() - 1000) })
    await SensorNode.updateOne({ _id: node._id }, { control_mode: 'MANUAL', override_expiry: new Date(Date.now() + 600_000) })

    expect(await closeOrphanedOverrideLogs()).toBe(0)
    expect((await RelayOverrideLog.findOne({ relay: 'misting' }).lean())!.ended_at).toBeNull()
  })
})

describe('tỷ lệ thời gian tự động (ANALYTICS-FR-011)', () => {
  it('hợp các khoảng override chồng nhau, cắt theo cửa sổ, tính cả override đang mở', async () => {
    const { owner, farm, zone, node, t } = await seed()
    const now = Date.now()
    const min = 60_000
    const log = (relay: string, startMinAgo: number, endMinAgo: number | null) => ({
      node_id: node._id, zone_id: zone._id, farm_id: farm._id, relay, state: true,
      started_by: owner._id, started_by_role: 'FARM_OWNER',
      started_at: new Date(now - startMinAgo * min), expires_at: new Date(now - startMinAgo * min + 30 * min),
      ended_at: endMinAgo === null ? null : new Date(now - endMinAgo * min), end_reason: endMinAgo === null ? undefined : 'EXPIRED',
    })
    await RelayOverrideLog.create([
      log('misting', 300, 270),          // 30 phút
      log('ventilation', 285, 255),      // chồng 15 phút với dòng trên → hợp lại 45 phút
      log('misting', 10, null),          // đang mở → 10 phút
      log('speaker', 1450, 1420),        // bắt đầu trước cửa sổ 24h, kết thúc trong cửa sổ → 20 phút
      log('speaker', 1800, 1500),        // nằm hẳn ngoài cửa sổ → không tính
    ])

    const res = await call('get', `/analytics/autonomy?zoneId=${zone._id}&range=24h`, t.owner).expect(200)
    // 45 + 10 + 20 = 75 phút trên 1440 phút → 94,8% tự động
    expect(res.body.data).toMatchObject({ range: '24h', manual_minutes: 75, auto_mode_pct: 94.8, override_count: 4 })
  })

  it('Zone chưa từng can thiệp tay là 100% tự động; range sai bị từ chối', async () => {
    const { zone, t } = await seed()
    const res = await call('get', `/analytics/autonomy?zoneId=${zone._id}`, t.expert).expect(200)
    expect(res.body.data).toMatchObject({ auto_mode_pct: 100, manual_minutes: 0, override_count: 0 })
    await call('get', `/analytics/autonomy?zoneId=${zone._id}&range=2y`, t.owner).expect(400)
    await call('get', `/analytics/autonomy?zoneId=${zone._id}&range=constructor`, t.owner).expect(400)
  })
})
