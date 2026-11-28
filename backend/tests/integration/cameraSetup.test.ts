import crypto from 'crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import adminRoutes from '@/routes/admin.route'
import agentRoutes from '@/routes/agent.route'
import deviceRoutes from '@/routes/devices.route'
import internalRoutes from '@/routes/internal.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { User } from '@/models/user.model'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import { migrateLegacyRtspUrls } from '@/services/cameraSource.service'
import { markStaleDevicesOffline, recordHeartbeat } from '@/services/device.service'
import { createProvisionedDevice, SETUP_CODE_TTL_MS } from '@/services/provisionedDevice.service'
import type { HeartbeatPayload } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
const ENV = {
  CAMERA_SOURCE_KEY: crypto.randomBytes(32).toString('base64'),
  DEVICE_BROKER_HOST: 'swiftletcare.example.vn',
  STREAM_PUBLISH_BASE: 'rtsps://swiftletcare.example.vn:8322',
  STREAM_AUTH_KEY: 'test-auth-key',
  STREAM_PUBLISH_SECRET: 'test-publish-secret',
}

const app = express()
app.use(express.json())
app.use('/admin', adminRoutes)
app.use('/agent', agentRoutes)
app.use('/devices', deviceRoutes)
app.use('/internal', internalRoutes)
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
beforeEach(() => { Object.assign(process.env, ENV) })
afterEach(async () => {
  await Promise.all([AuditLog, CameraNode, Farm, House, Notification, Zone, ProvisionedDevice, User].map(m => (m as typeof User).deleteMany({})))
  jest.clearAllMocks()
})

const tokenFor = (id: unknown, role: string) => jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`

async function seed() {
  const mk = (name: string, role: string) => User.create({ email: `${name}@test.vn`, password_hash: 'password123', full_name: name, role })
  const [admin, owner, expert, technician, stranger] = await Promise.all([
    mk('admin', 'ADMIN'), mk('owner', 'FARM_OWNER'), mk('expert', 'DOMAIN_EXPERT'), mk('tech', 'FARM_TECHNICIAN'), mk('stranger', 'FARM_OWNER'),
  ])
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }, { user_id: technician._id, role: 'FARM_TECHNICIAN' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H', technicians: [{ user_id: technician._id, primary: true }] })
  await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Z' })
  const stock = await createProvisionedDevice(String(admin._id), { device_id: 'cam-h1-01', kind: 'CAMERA' })
  const camera = await CameraNode.create({ device_id: 'cam-h1-01', house_id: house._id, status: 'ONLINE' })
  const entry = (await ProvisionedDevice.findOne({ device_id: 'cam-h1-01' }))!
  return {
    camera, stock, entry, adminId: String(admin._id), farmId: farm._id,
    tokens: {
      admin: tokenFor(admin._id, 'ADMIN'), owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT'),
      technician: tokenFor(technician._id, 'FARM_TECHNICIAN'), stranger: tokenFor(stranger._id, 'FARM_OWNER'),
    },
  }
}

const SOURCE = { host: '203.0.113.7', port: 18554, username: 'admin', password: 'p@ss:w/rd', path: '/stream1' }

describe('cài đặt camera đếm chim từ web (FARM-FR-004b, FARM-FR-010)', () => {
  it('mã cài đặt: Administrator tạo cho camera, nút AI đổi lấy danh tính một lần; mật khẩu broker cũ hết hiệu lực', async () => {
    const { entry, stock, tokens, adminId } = await seed()
    const issue = (token: string, id: unknown) => request(app).post(`/admin/provisioned-devices/${id}/setup-code`).set('Authorization', `Bearer ${token}`)

    await issue(tokens.owner, entry._id).expect(403)
    // Bộ điều khiển nạp qua USB, không dùng mã cài đặt
    await createProvisionedDevice(adminId, { device_id: 'ctl-1', kind: 'SENSOR' })
    await issue(tokens.admin, (await ProvisionedDevice.findOne({ device_id: 'ctl-1' }))!._id).expect(400)

    const issued = (await issue(tokens.admin, entry._id).expect(201)).body.data
    expect(issued.setup_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(new Date(issued.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(SETUP_CODE_TTL_MS)

    // Gõ thường, không dấu "-" vẫn nhận
    const typed = issued.setup_code.replace('-', '').toLowerCase()
    const enrolled = (await request(app).post('/agent/enroll').send({ setup_code: typed }).expect(200)).body.data
    expect(enrolled).toMatchObject({ device_id: 'cam-h1-01', broker: { host: 'swiftletcare.example.vn', port: 8883, tls: true } })
    expect(enrolled.broker_secret).not.toBe(stock.broker_secret)
    expect(enrolled.stream_publish_url).toBe(`rtsps://cam-h1-01:${enrolled.broker_secret}@swiftletcare.example.vn:8322/cam-cam-h1-01`)

    // Một lần: dùng lại bị từ chối; mật khẩu cũ không còn dùng được
    await request(app).post('/agent/enroll').send({ setup_code: issued.setup_code }).expect(400)
    await request(app).get('/agent/camera-source').set('Authorization', basic('cam-h1-01', stock.broker_secret)).expect(401)
    await request(app).get('/agent/camera-source').set('Authorization', basic('cam-h1-01', enrolled.broker_secret)).expect(200)

    // Hết hạn
    const again = (await issue(tokens.admin, entry._id).expect(201)).body.data
    await ProvisionedDevice.updateOne({ _id: entry._id }, { setup_code_expires_at: new Date(Date.now() - 1000) })
    await request(app).post('/agent/enroll').send({ setup_code: again.setup_code }).expect(400)
    expect(await AuditLog.countDocuments({ action: 'AI_NODE_ENROLLED' })).toBe(1)
  })

  it('địa chỉ camera: Farm Owner sửa; mật khẩu mã hoá, không bao giờ trả ra; nút AI lấy được đúng URL', async () => {
    const { camera, stock, tokens } = await seed()
    const put = (token: string, body: object) => request(app).put(`/devices/camera-nodes/${camera._id}/source`).set('Authorization', `Bearer ${token}`).send(body)

    for (const token of [tokens.expert, tokens.admin]) await put(token, SOURCE).expect(403)
    await put(tokens.stranger, SOURCE).expect(403)
    await put(tokens.owner, { ...SOURCE, host: 'rtsp://x' }).expect(422)
    await put(tokens.owner, { ...SOURCE, path: 'stream1' }).expect(422)

    // Chưa nhập: nút AI nhận "chưa có địa chỉ"
    const empty = await request(app).get('/agent/camera-source').set('Authorization', basic('cam-h1-01', stock.broker_secret)).expect(200)
    expect(empty.body.data).toEqual({ version: 0, rtsp_url: null })

    const saved = (await put(tokens.owner, SOURCE).expect(200)).body.data
    expect(saved.source).toMatchObject({ host: '203.0.113.7', port: 18554, username: 'admin', path: '/stream1', has_password: true, version: 1 })
    expect(JSON.stringify(saved)).not.toContain('p@ss')
    const stored = await CameraNode.findById(camera._id).select('+camera_source +camera_source.password_encrypted').lean()
    expect(stored!.camera_source!.password_encrypted).not.toContain('p@ss')
    expect(publishDeviceConfig).toHaveBeenLastCalledWith('cam-h1-01', expect.objectContaining({ camera_source_version: 1 }))
    expect(JSON.stringify((publishDeviceConfig as jest.Mock).mock.calls)).not.toContain('p@ss')

    const read = await request(app).get(`/devices/camera-nodes/${camera._id}/source`).set('Authorization', `Bearer ${tokens.owner}`).expect(200)
    expect(JSON.stringify(read.body)).not.toContain('password_encrypted')

    const agent = await request(app).get('/agent/camera-source').set('Authorization', basic('cam-h1-01', stock.broker_secret)).expect(200)
    expect(agent.body.data).toEqual({ version: 1, rtsp_url: 'rtsp://admin:p%40ss%3Aw%2Frd@203.0.113.7:18554/stream1' })
    expect(agent.headers['cache-control']).toBe('no-store')
    await request(app).get('/agent/camera-source').set('Authorization', basic('cam-h1-01', 'sai')).expect(401)
    await request(app).get('/agent/camera-source').expect(401)

    // Không gửi mật khẩu: giữ mật khẩu cũ; chuỗi rỗng: bỏ mật khẩu
    const { password: _password, ...withoutPassword } = SOURCE
    await put(tokens.owner, { ...withoutPassword, host: '203.0.113.8' }).expect(200)
    const kept = await request(app).get('/agent/camera-source').set('Authorization', basic('cam-h1-01', stock.broker_secret))
    expect(kept.body.data).toEqual({ version: 2, rtsp_url: 'rtsp://admin:p%40ss%3Aw%2Frd@203.0.113.8:18554/stream1' })
    await put(tokens.owner, { ...SOURCE, password: '' }).expect(200)
    const cleared = await request(app).get('/agent/camera-source').set('Authorization', basic('cam-h1-01', stock.broker_secret))
    expect(cleared.body.data.rtsp_url).toBe('rtsp://admin@203.0.113.7:18554/stream1')

    // Thiếu khoá thì không lưu được mật khẩu
    delete process.env.CAMERA_SOURCE_KEY
    await put(tokens.owner, SOURCE).expect(503)
    expect(await AuditLog.countDocuments({ action: 'CAMERA_SOURCE_UPDATED' })).toBe(3)
  })

  it('heartbeat của nút AI báo tình trạng camera; giá trị lạ bị bỏ qua', async () => {
    const { camera, tokens } = await seed()
    const heartbeat = (cameraStatus: unknown) => recordHeartbeat({ deviceId: 'cam-h1-01', fps: 20, cameraStatus } as unknown as HeartbeatPayload)
    await heartbeat('AUTH_FAILED')
    const read = await request(app).get(`/devices/camera-nodes/${camera._id}/source`).set('Authorization', `Bearer ${tokens.owner}`).expect(200)
    expect(read.body.data).toMatchObject({ camera_status: 'AUTH_FAILED', source: null })
    await heartbeat('HACKED')
    expect((await CameraNode.findById(camera._id).lean())!.camera_status).toBe('AUTH_FAILED')
    await heartbeat('OK')
    expect((await CameraNode.findById(camera._id).lean())!.camera_status).toBe('OK')
  })

  it('nút AI đẩy hình bằng tài khoản riêng: chỉ đường của nó, đọc chỉ hình gốc; mục kho thu hồi thì bị chặn', async () => {
    const { entry, stock } = await seed()
    const auth = (body: object) => request(app).post('/internal/stream-auth?key=test-auth-key').send(body)
    const own = { user: 'cam-h1-01', password: stock.broker_secret }
    await auth({ ...own, action: 'publish', path: 'cam-cam-h1-01' }).expect(200)
    await auth({ ...own, action: 'publish', path: 'cam-cam-h1-01-raw' }).expect(200)
    await auth({ ...own, action: 'read', path: 'cam-cam-h1-01-raw' }).expect(200)
    await auth({ ...own, action: 'read', path: 'cam-cam-h1-01' }).expect(401)
    await auth({ ...own, action: 'publish', path: 'cam-cam-other' }).expect(401)
    await auth({ ...own, password: 'sai', action: 'publish', path: 'cam-cam-h1-01' }).expect(401)
    await ProvisionedDevice.updateOne({ _id: entry._id }, { revoked_at: new Date() })
    await auth({ ...own, action: 'publish', path: 'cam-cam-h1-01' }).expect(401)
  })

  it('migrate:camera-source chuyển URL cũ lưu không mã hoá sang dạng mã hoá; chạy lại không đổi gì', async () => {
    const { camera, stock } = await seed()
    await CameraNode.collection.updateOne({ _id: camera._id }, { $set: { rtsp_url: 'rtsp://admin:old%40pw@192.168.1.163:554/stream1' } })
    expect(await migrateLegacyRtspUrls()).toEqual({ moved: 1, skipped: 0 })
    const raw = await CameraNode.collection.findOne({ _id: camera._id })
    expect(raw!.rtsp_url).toBeUndefined()
    expect(raw!.camera_source.password_encrypted).not.toContain('old')
    const agent = await request(app).get('/agent/camera-source').set('Authorization', basic('cam-h1-01', stock.broker_secret))
    expect(agent.body.data).toEqual({ version: 1, rtsp_url: 'rtsp://admin:old%40pw@192.168.1.163:554/stream1' })
    expect(await migrateLegacyRtspUrls()).toEqual({ moved: 0, skipped: 0 })
  })

  it('Farm Technician của nhà được giao nhập và đọc được địa chỉ camera, báo Farm Owner không kèm địa chỉ; nhà khác thì 403', async () => {
    const { camera, tokens, farmId } = await seed()
    const path = `/devices/camera-nodes/${camera._id}/source`
    await request(app).put(path).set('Authorization', `Bearer ${tokens.technician}`).send(SOURCE).expect(200)
    const read = await request(app).get(path).set('Authorization', `Bearer ${tokens.technician}`).expect(200)
    expect(read.body.data.source).toMatchObject({ host: '203.0.113.7', has_password: true, version: 1 })
    expect(JSON.stringify(read.body)).not.toContain('p@ss')

    expect(await AuditLog.countDocuments({ action: 'CAMERA_SOURCE_UPDATED' })).toBe(1)
    const notices = await Notification.find({ title: 'Kỹ thuật viên đã đổi địa chỉ camera' }).lean()
    expect(notices.length).toBeGreaterThan(0)
    expect(JSON.stringify(notices)).not.toMatch(/203\.0\.113\.7|p@ss/)

    // Kỹ thuật viên của farm nhưng chưa được giao nhà này
    const other = await User.create({ email: 'tech2@test.vn', password_hash: 'password123', full_name: 'tech2', role: 'FARM_TECHNICIAN' })
    await Farm.updateOne({ _id: farmId }, { $push: { members: { user_id: other._id, role: 'FARM_TECHNICIAN' } } })
    const otherToken = tokenFor(other._id, 'FARM_TECHNICIAN')
    await request(app).get(path).set('Authorization', `Bearer ${otherToken}`).expect(403)
    await request(app).put(path).set('Authorization', `Bearer ${otherToken}`).send(SOURCE).expect(403)
  })

  it('địa chỉ camera không lộ cho Kỹ thuật viên, Chuyên gia, Administrator qua danh sách, tổng quan hệ thống, vòng đếm', async () => {
    const { camera, tokens } = await seed()
    await request(app).put(`/devices/camera-nodes/${camera._id}/source`).set('Authorization', `Bearer ${tokens.owner}`).send(SOURCE).expect(200)
    const leaks = (body: unknown) => /203\.0\.113\.7|camera_source|password_encrypted/.test(JSON.stringify(body))

    for (const token of [tokens.technician, tokens.expert]) {
      const list = await request(app).get(`/devices/camera-nodes?houseId=${camera.house_id}`).set('Authorization', `Bearer ${token}`).expect(200)
      expect(list.body.data).toHaveLength(1)
      expect(leaks(list.body)).toBe(false)
    }
    const system = await request(app).get('/devices/system-status').set('Authorization', `Bearer ${tokens.admin}`).expect(200)
    expect(leaks(system.body)).toBe(false)
    const ring = await request(app).put(`/devices/camera-nodes/${camera._id}/counting-ring`).set('Authorization', `Bearer ${tokens.expert}`)
      .send({ rings: [] }).expect(200)
    expect(leaks(ring.body)).toBe(false)
    // Config gửi khi đổi vòng vẫn mang đúng phiên bản địa chỉ (đọc riêng vì camera_source không được chọn mặc định)
    expect(publishDeviceConfig).toHaveBeenLastCalledWith('cam-h1-01', expect.objectContaining({ camera_source_version: 1 }))
  })

  it('nút AI im quá lâu thì tình trạng camera cũ bị xoá, web hiện "chưa báo" thay vì "Đang nhận hình"', async () => {
    const { camera } = await seed()
    await recordHeartbeat({ deviceId: 'cam-h1-01', fps: 20, cameraStatus: 'OK' } as unknown as HeartbeatPayload)
    await CameraNode.updateOne({ _id: camera._id }, { last_heartbeat: new Date(Date.now() - 10 * 60 * 1000) })
    await markStaleDevicesOffline()
    const offline = (await CameraNode.findById(camera._id).lean())!
    expect(offline.status).toBe('OFFLINE')
    expect(offline.camera_status).toBeUndefined()
  })
})
