/**
 * Onboarding thiết bị bởi Technician — FARM-FR-003/004, Flow 1 bước 3–4, case 3a, 8a.
 * Trọng tâm: phải có đúng cặp {device_id, secretKey} do công ty cấp; thiết bị
 * đã thuộc Farm khác báo lỗi riêng; node PENDING quá 15 phút được đánh dấu.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import deviceRoutes from '@/routes/devices.route'
import adminRoutes from '@/routes/admin.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SensorNode, CameraNode } from '@/models/device.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { User } from '@/models/user.model'
import { markOverdueActivations, recordHeartbeat, ACTIVATION_TIMEOUT_MS } from '@/services/device.service'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use('/admin', adminRoutes)
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
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), House.deleteMany({}), Zone.deleteMany({}),
    SensorNode.deleteMany({}), CameraNode.deleteMany({}), ProvisionedDevice.deleteMany({}), User.deleteMany({}),
  ])
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function zoneIn(ownerId: unknown, name: string) {
  const farm = await Farm.create({ name, address: 'x', region: 'HCMC', owner_id: ownerId })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  return { farm, zone }
}

async function seed() {
  const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'Admin', role: 'ADMIN' })
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const tech = await User.create({
    email: 'tech@test.vn', password_hash: 'password123', full_name: 'Tech', role: 'TECHNICIAN', assigned_regions: ['HCMC'],
  })
  const a = await zoneIn(owner._id, 'Farm A')
  const b = await zoneIn(owner._id, 'Farm B')
  const adminToken = tokenFor(admin._id, 'ADMIN')

  // Admin cấp thiết bị qua API — secret_key chỉ xuất hiện trong response này
  const provisioned = await request(app).post('/admin/provisioned-devices')
    .set('Authorization', `Bearer ${adminToken}`).send({ device_id: 'node_100', kind: 'SENSOR' }).expect(201)

  return { tech, techToken: tokenFor(tech._id, 'TECHNICIAN'), adminToken, a, b, secretKey: provisioned.body.data.secret_key as string }
}

const register = (token: string, body: object) =>
  request(app).post('/devices/sensor-nodes/register').set('Authorization', `Bearer ${token}`).send(body)

describe('kho thiết bị (Admin)', () => {
  it('trả secretKey 1 lần, chỉ lưu hash, không cho trùng device_id', async () => {
    const { adminToken, secretKey } = await seed()
    expect(secretKey).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)

    const stored = await ProvisionedDevice.findOne({ device_id: 'node_100' }).select('+secret_key_hash').lean()
    expect(stored!.secret_key_hash).not.toContain(secretKey)

    const list = await request(app).get('/admin/provisioned-devices').set('Authorization', `Bearer ${adminToken}`).expect(200)
    expect(list.body.data[0]).not.toHaveProperty('secret_key_hash')

    await request(app).post('/admin/provisioned-devices').set('Authorization', `Bearer ${adminToken}`)
      .send({ device_id: 'node_100', kind: 'SENSOR' }).expect(409)
  })
})

describe('POST /devices/sensor-nodes/register', () => {
  it('đúng secretKey → PENDING, đánh dấu đã kích hoạt; không phân biệt hoa/thường', async () => {
    const { techToken, a, secretKey, tech } = await seed()
    const res = await register(techToken, { device_id: 'node_100', zone_id: String(a.zone._id), secret_key: secretKey.toLowerCase() }).expect(201)

    expect(res.body.data.status).toBe('PENDING')
    expect(res.body.data.registered_by).toBe(String(tech._id))
    expect((await ProvisionedDevice.findOne({ device_id: 'node_100' }))!.claimed_at).toBeInstanceOf(Date)
  })

  it('thiếu secretKey → 422; sai key hoặc device_id lạ → 400 cùng 1 thông báo', async () => {
    const { techToken, a } = await seed()
    await register(techToken, { device_id: 'node_100', zone_id: String(a.zone._id) }).expect(422)

    const wrong = await register(techToken, { device_id: 'node_100', zone_id: String(a.zone._id), secret_key: 'AAAA-BBBB-CCCC' }).expect(400)
    const unknown = await register(techToken, { device_id: 'ghost', zone_id: String(a.zone._id), secret_key: 'AAAA-BBBB-CCCC' }).expect(400)
    expect(wrong.body.error.message).toBe(unknown.body.error.message)
    expect(await SensorNode.countDocuments()).toBe(0)
  })

  it('sensor key không dùng để đăng ký camera', async () => {
    const { techToken, a, secretKey } = await seed()
    await request(app).post('/devices/camera-nodes/register').set('Authorization', `Bearer ${techToken}`)
      .send({ device_id: 'node_100', zone_id: String(a.zone._id), secret_key: secretKey }).expect(400)
  })

  it('thiết bị đã thuộc Farm khác → 409 báo rõ (Flow 1 case 3a)', async () => {
    const { techToken, a, b, secretKey } = await seed()
    await register(techToken, { device_id: 'node_100', zone_id: String(a.zone._id), secret_key: secretKey }).expect(201)

    const res = await register(techToken, { device_id: 'node_100', zone_id: String(b.zone._id), secret_key: secretKey }).expect(409)
    expect(res.body.error.message).toBe('Thiết bị đã thuộc về Farm khác')
    const same = await register(techToken, { device_id: 'node_100', zone_id: String(a.zone._id), secret_key: secretKey }).expect(409)
    expect(same.body.error.message).toBe('device_id đã được đăng ký')
  })
})

describe('markOverdueActivations (Flow 1 case 8a)', () => {
  it('đánh dấu node PENDING quá 15 phút 1 lần, heartbeat đầu tiên gỡ cờ', async () => {
    const { tech, a } = await seed()
    const old = new Date(Date.now() - ACTIVATION_TIMEOUT_MS - 60_000)
    const late = await SensorNode.create({ device_id: 'late', zone_id: a.zone._id, registered_at: old, registered_by: tech._id })
    await SensorNode.create({ device_id: 'fresh', zone_id: a.zone._id })
    await SensorNode.create({ device_id: 'online', zone_id: a.zone._id, status: 'ONLINE', registered_at: old })

    expect(await markOverdueActivations()).toBe(1)
    expect((await SensorNode.findById(late._id))!.activation_overdue_at).toBeInstanceOf(Date)
    expect(await AuditLog.countDocuments({ action: 'DEVICE_ACTIVATION_OVERDUE' })).toBe(1)
    expect(await markOverdueActivations()).toBe(0)

    await recordHeartbeat({ deviceId: 'late' } as never)
    const healed = (await SensorNode.findById(late._id))!
    expect(healed.status).toBe('ONLINE')
    expect(healed.activation_overdue_at).toBeUndefined()
  })
})
