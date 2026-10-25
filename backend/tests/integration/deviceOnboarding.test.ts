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
import { expireManualOverrides, markOverdueActivations, markOtaTimeouts, recordHeartbeat, ACTIVATION_TIMEOUT_MS, OTA_CONFIRM_TIMEOUT_MS } from '@/services/device.service'
import { createProvisionedDevice } from '@/services/provisionedDevice.service'
import { notifyUser } from '@/services/notification.service'
import { RESTORE_WINDOW_MS } from '@/services/device.service'
import { Alert } from '@/models/alert.model'
import { createAlert, renotifyStaleAlerts } from '@/services/alert.service'
import { removeFarm, updateFarm } from '@/services/farm.service'
import { publishCommand } from '@/mqtt/mqtt.client'
import * as socket from '@/socket'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
process.env.OTA_ALLOWED_HOSTS = 'fw.swiftletcare.vn'

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
    Alert.deleteMany({}),
  ])
  jest.clearAllMocks()
  ;(publishCommand as jest.Mock).mockReturnValue(true)
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function zoneIn(ownerId: unknown, name: string) {
  const farm = await Farm.create({ name, address: 'x', owner_id: ownerId })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  return { farm, zone }
}

async function seed() {
  const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'Admin', role: 'ADMIN' })
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const tech = await User.create({
    email: 'tech@test.vn', password_hash: 'password123', full_name: 'Tech', role: 'TECHNICIAN',
  })
  const a = await zoneIn(owner._id, 'Farm A')
  const b = await zoneIn(owner._id, 'Farm B')
  const adminToken = tokenFor(admin._id, 'ADMIN')

  // Admin cấp thiết bị qua API — secret_key chỉ xuất hiện trong response này
  const provisioned = await request(app).post('/admin/provisioned-devices')
    .set('Authorization', `Bearer ${adminToken}`).send({ device_id: 'node_100', kind: 'SENSOR' }).expect(201)

  return {
    tech, techToken: tokenFor(tech._id, 'TECHNICIAN'), ownerToken: tokenFor(owner._id, 'FARM_OWNER'), adminToken, a, b,
    secretKey: provisioned.body.data.secret_key as string,
  }
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

  it('camera đếm chim đăng ký vào House (SRS v2.1.8); zone_id cũ quy ra House chứa Zone; farm khác → 409', async () => {
    const { techToken, adminToken, a, b } = await seed()
    const keyFor = async (device_id: string) => (await request(app).post('/admin/provisioned-devices')
      .set('Authorization', `Bearer ${adminToken}`).send({ device_id, kind: 'CAMERA' }).expect(201)).body.data.secret_key as string
    const registerCam = (body: object) =>
      request(app).post('/devices/camera-nodes/register').set('Authorization', `Bearer ${techToken}`).send(body)

    const byHouse = await registerCam({ device_id: 'cam_1', house_id: String(a.zone.house_id), secret_key: await keyFor('cam_1') }).expect(201)
    expect(byHouse.body.data).toMatchObject({ house_id: String(a.zone.house_id), status: 'PENDING' })
    expect(byHouse.body.data).not.toHaveProperty('zone_id')

    const byZone = await registerCam({ device_id: 'cam_2', zone_id: String(a.zone._id), secret_key: await keyFor('cam_2') }).expect(201)
    expect(byZone.body.data.house_id).toBe(String(a.zone.house_id))

    await registerCam({ device_id: 'cam_3', secret_key: await keyFor('cam_3') }).expect(422)     // thiếu cả house_id lẫn zone_id
    expect(await AuditLog.countDocuments({ action: 'DEVICE_REGISTERED', 'metadata.houseId': String(a.zone.house_id) })).toBe(2)
    expect(await CameraNode.countDocuments({ house_id: b.zone.house_id })).toBe(0)
  })

  it('sensor key không dùng để đăng ký camera', async () => {
    const { techToken, a, secretKey } = await seed()
    await request(app).post('/devices/camera-nodes/register').set('Authorization', `Bearer ${techToken}`)
      .send({ device_id: 'node_100', house_id: String(a.zone.house_id), secret_key: secretKey }).expect(400)
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
    // Camera chưa có kênh heartbeat (ai-pipeline chưa deploy) nên không bị báo quá hạn
    await CameraNode.create({ device_id: 'cam_late', house_id: a.zone.house_id, registered_at: old, registered_by: tech._id })

    expect(await markOverdueActivations()).toBe(1)
    expect((await SensorNode.findById(late._id))!.activation_overdue_at).toBeInstanceOf(Date)
    expect(await AuditLog.countDocuments({ action: 'DEVICE_ACTIVATION_OVERDUE' })).toBe(1)
    expect(await markOverdueActivations()).toBe(0)
    expect((await CameraNode.findOne({ device_id: 'cam_late' }))!.activation_overdue_at).toBeUndefined()

    await recordHeartbeat({ deviceId: 'late' } as never)
    const healed = (await SensorNode.findById(late._id))!
    expect(healed.status).toBe('ONLINE')
    expect(healed.activation_overdue_at).toBeUndefined()
  })
})

describe('gỡ bỏ / thay thế thiết bị (FARM-FR-008)', () => {
  async function installed() {
    const ctx = await seed()
    const res = await register(ctx.techToken, { device_id: 'node_100', zone_id: String(ctx.a.zone._id), secret_key: ctx.secretKey }).expect(201)
    return { ...ctx, nodeId: res.body.data._id as string }
  }
  const post = (path: string, token: string, body: object) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body)

  it('gỡ bỏ: giữ document, ẩn khỏi danh sách, bỏ qua heartbeat, chặn lệnh', async () => {
    const { techToken, ownerToken, nodeId } = await installed()
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, {}).expect(422)
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Hỏng nguồn' }).expect(200)

    const node = (await SensorNode.findById(nodeId))!
    expect(node.decommissioned_at).toBeInstanceOf(Date)
    const list = await request(app).get('/devices/sensor-nodes').set('Authorization', `Bearer ${techToken}`).expect(200)
    expect(list.body.data).toHaveLength(0)

    await expect(recordHeartbeat({ deviceId: 'node_100' } as never)).rejects.toThrow()
    // Relay chỉ Farm Owner bật được (ENV-FR-016) — thiết bị đã gỡ thì 409 thay vì gửi lệnh
    await post(`/devices/sensor-nodes/${nodeId}/relay`, ownerToken, { relayName: 'misting', state: true }).expect(409)
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'lần 2' }).expect(409)
    expect(await AuditLog.countDocuments({ action: 'DEVICE_DECOMMISSIONED' })).toBe(1)
  })

  it('thay thế: node mới cùng zone, chép lịch loa, node cũ trỏ replaced_by', async () => {
    const { techToken, nodeId, tech, a } = await installed()
    await SensorNode.updateOne({ _id: nodeId }, { speaker_schedule: { enabled: false, windows: [{ start: '05:00', end: '06:00' }] } })
    const { secret_key } = await createProvisionedDevice(String(tech._id), { device_id: 'node_200', kind: 'SENSOR' })

    await post(`/devices/sensor-nodes/${nodeId}/replace`, techToken, { new_device_id: 'node_200', secret_key: 'WRONG-KEY', reason: 'x' }).expect(400)
    expect((await SensorNode.findById(nodeId))!.decommissioned_at).toBeUndefined() // key sai → node cũ còn nguyên

    const res = await post(`/devices/sensor-nodes/${nodeId}/replace`, techToken, { new_device_id: 'node_200', secret_key, reason: 'Cảm biến chết' }).expect(201)
    const { oldNode, newNode } = res.body.data
    expect(newNode.zone_id).toBe(String(a.zone._id))
    expect(newNode.status).toBe('PENDING')
    expect(newNode.speaker_schedule.enabled).toBe(false)
    expect(oldNode.replaced_by).toBe(newNode._id)
    expect(await AuditLog.countDocuments({ action: 'DEVICE_REPLACED' })).toBe(1)
  })

  it('thiết bị đã gỡ lắp lại được, bản ghi cũ đổi tên nhưng giữ _id', async () => {
    const { techToken, nodeId, secretKey, b } = await installed()
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Chuyển farm' }).expect(200)

    const res = await register(techToken, { device_id: 'node_100', zone_id: String(b.zone._id), secret_key: secretKey }).expect(201)
    expect(res.body.data._id).not.toBe(nodeId)
    expect((await SensorNode.findById(nodeId))!.device_id).toMatch(/^node_100#retired-/)
  })

  it('thiết bị đang chạy chỉ gỡ được khi gửi force, và Farm Owner được báo', async () => {
    const { techToken, nodeId, a } = await installed()
    await SensorNode.updateOne({ _id: nodeId }, { status: 'ONLINE', last_heartbeat: new Date() })
    ;(notifyUser as jest.Mock).mockClear()

    const blocked = await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Thu hồi' }).expect(409)
    expect(blocked.body.error.message).toContain('force=true')
    expect((await SensorNode.findById(nodeId))!.decommissioned_at).toBeUndefined() // chưa đụng gì tới document
    expect(notifyUser).not.toHaveBeenCalled()

    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Hết hợp đồng, thu hồi', force: true }).expect(200)
    expect((await SensorNode.findById(nodeId))!.decommissioned_at).toBeInstanceOf(Date)
    const audit = await AuditLog.findOne({ action: 'DEVICE_DECOMMISSIONED' }).lean()
    expect(audit!.metadata).toMatchObject({ forcedWhileOnline: true })
    expect((notifyUser as jest.Mock).mock.calls[0][0]).toBe(String(a.farm.owner_id))
  })

  it('khôi phục thiết bị gỡ nhầm trong 24 giờ', async () => {
    const { techToken, nodeId } = await installed()
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Bấm nhầm' }).expect(200)

    await post(`/devices/sensor-nodes/${nodeId}/restore`, techToken, {}).expect(422) // thiếu lý do
    await post(`/devices/sensor-nodes/${nodeId}/restore`, techToken, { reason: 'Gỡ nhầm thiết bị' }).expect(200)

    const node = (await SensorNode.findById(nodeId))!
    expect(node.decommissioned_at).toBeUndefined()
    expect(node.status).toBe('PENDING') // chưa từng kết nối → vẫn đang chờ kích hoạt
    expect(await AuditLog.countDocuments({ action: 'DEVICE_RESTORED' })).toBe(1)

    const list = await request(app).get('/devices/sensor-nodes').set('Authorization', `Bearer ${techToken}`).expect(200)
    expect(list.body.data.map((n: { device_id: string }) => n.device_id)).toContain('node_100')
    await recordHeartbeat({ deviceId: 'node_100' } as never) // heartbeat được nhận lại
    expect((await SensorNode.findById(nodeId))!.status).toBe('ONLINE')

    await post(`/devices/sensor-nodes/${nodeId}/restore`, techToken, { reason: 'lần 2' }).expect(409)
  })

  it('khôi phục phát đúng trạng thái đã lưu qua socket (PENDING, không phải OFFLINE)', async () => {
    const { techToken, nodeId } = await installed()
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Bấm nhầm' }).expect(200)
    const emit = jest.spyOn(socket, 'emitDeviceStatusChange')
    try {
      await post(`/devices/sensor-nodes/${nodeId}/restore`, techToken, { reason: 'Gỡ nhầm' }).expect(200)
      expect(emit).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ status: 'PENDING' }))
    } finally {
      emit.mockRestore()
    }
  })

  it('khôi phục xoá cờ kích hoạt quá hạn, job đánh dấu lại được', async () => {
    const { techToken, nodeId } = await installed()
    await SensorNode.updateOne({ _id: nodeId }, { registered_at: new Date(Date.now() - ACTIVATION_TIMEOUT_MS - 60_000) })
    expect(await markOverdueActivations()).toBe(1)

    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Bấm nhầm' }).expect(200)
    await post(`/devices/sensor-nodes/${nodeId}/restore`, techToken, { reason: 'Khôi phục' }).expect(200)
    expect((await SensorNode.findById(nodeId))!.activation_overdue_at).toBeUndefined()

    // Vẫn chưa lên mạng → job phải đánh dấu lại được
    expect(await markOverdueActivations()).toBe(1)
  })

  it('không khôi phục được khi quá 24 giờ hoặc device_id đã dùng lại', async () => {
    const { techToken, nodeId, secretKey, b } = await installed()
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Thu hồi' }).expect(200)
    await SensorNode.updateOne({ _id: nodeId }, { decommissioned_at: new Date(Date.now() - RESTORE_WINDOW_MS - 1000) })

    const late = await post(`/devices/sensor-nodes/${nodeId}/restore`, techToken, { reason: 'Muộn' }).expect(409)
    expect(late.body.error.message).toContain('đăng ký lại')

    // Đăng ký lại device_id cho farm khác → bản ghi cũ đổi tên, không khôi phục được nữa
    await SensorNode.updateOne({ _id: nodeId }, { decommissioned_at: new Date() })
    await register(techToken, { device_id: 'node_100', zone_id: String(b.zone._id), secret_key: secretKey }).expect(201)
    const taken = await post(`/devices/sensor-nodes/${nodeId}/restore`, techToken, { reason: 'Thử lại' }).expect(409)
    expect(taken.body.error.message).toContain('đã được đăng ký lại')
  })

  it('thay thiết bị đang chạy không cần force riêng', async () => {
    const { techToken, nodeId, tech } = await installed()
    await SensorNode.updateOne({ _id: nodeId }, { status: 'ONLINE', last_heartbeat: new Date() })
    const { secret_key } = await createProvisionedDevice(String(tech._id), { device_id: 'node_300', kind: 'SENSOR' })

    await post(`/devices/sensor-nodes/${nodeId}/replace`, techToken, {
      new_device_id: 'node_300', secret_key, reason: 'Nâng cấp đời máy',
    }).expect(201)
    expect((await SensorNode.findById(nodeId))!.decommissioned_at).toBeInstanceOf(Date)
  })
})

describe('POST /devices/sensor-nodes/:id/commands (TICKET-FR-008, Flow 15)', () => {
  const OTA = { version: '1.4.1', url: 'https://fw.swiftletcare.vn/esp32-1.4.1.bin', sha256: 'a'.repeat(64) }
  const send = (token: string, id: unknown, body: object) =>
    request(app).post(`/devices/sensor-nodes/${id}/commands`).set('Authorization', `Bearer ${token}`).send(body)

  async function onlineNode() {
    const ctx = await seed()
    const node = await SensorNode.create({ device_id: 'node_100', zone_id: ctx.a.zone._id, status: 'ONLINE', firmware_version: '1.4.0' })
    return { ...ctx, node }
  }

  it('PUSH_CONFIG đẩy toàn bộ cấu hình: ngưỡng, hệ số mờ, tham số phát hiện và lịch loa', async () => {
    const { techToken, node, a } = await onlineNode()
    await send(techToken, node._id, { command: 'PUSH_CONFIG' }).expect(202)
    const [, , zoneId, topic, payload] = (publishCommand as jest.Mock).mock.calls[0]
    expect([zoneId, topic]).toEqual([String(a.zone._id), 'config/update'])
    // Thiết bị lệch hệ số mờ/lịch loa thì lệnh "đẩy lại cấu hình" phải sửa được cả phần đó
    expect(payload).toMatchObject({
      deviceId: 'node_100',
      temp_min: expect.any(Number), co2_max: expect.any(Number),
      fuzzy_humidity_band: expect.any(Number), fuzzy_window_sec: expect.any(Number),
      noise_margin_db: expect.any(Number), pump_dry_on_sec: expect.any(Number),
      speaker_schedule_enabled: expect.any(Boolean), speaker_volume: expect.any(Number),
    })
  })

  it('OTA: validate đầu vào, lưu ota_pending, heartbeat đúng version thì xác nhận thành công', async () => {
    const { techToken, node } = await onlineNode()
    await send(techToken, node._id, { command: 'OTA', ota: { ...OTA, sha256: 'xyz' } }).expect(422)
    await send(techToken, node._id, { command: 'OTA', ota: { ...OTA, version: '1.4.0' } }).expect(409)

    await send(techToken, node._id, { command: 'OTA', ota: OTA }).expect(202)
    expect((publishCommand as jest.Mock).mock.calls[0][4]).toEqual({ deviceId: node.device_id, command: 'OTA', ota: OTA })
    expect((await SensorNode.findById(node._id))!.ota_pending!.version).toBe('1.4.1')

    await recordHeartbeat({ deviceId: 'node_100', firmwareVersion: '1.4.0' } as never) // chưa lên bản mới
    expect((await SensorNode.findById(node._id))!.ota_pending).toBeDefined()
    await recordHeartbeat({ deviceId: 'node_100', firmwareVersion: '1.4.1' } as never)
    const done = (await SensorNode.findById(node._id))!
    expect(done.ota_pending).toBeUndefined()
    expect(done.firmware_version).toBe('1.4.1')
    expect(await AuditLog.countDocuments({ action: 'DEVICE_OTA_SUCCEEDED' })).toBe(1)
  })

  it('thiết bị ONLINE nhận lệnh và được ghi audit; thiết bị OFFLINE bị từ chối', async () => {
    const { techToken, node } = await onlineNode()
    await send(techToken, node._id, { command: 'RESTART' }).expect(202)
    const audit = await AuditLog.findOne({ action: 'DEVICE_COMMAND_SENT' }).lean()
    expect(audit!.metadata).toMatchObject({ deviceId: node.device_id, command: 'RESTART' })

    await SensorNode.updateOne({ _id: node._id }, { status: 'OFFLINE' })
    await send(techToken, node._id, { command: 'RESTART' }).expect(409)
    expect(publishCommand).toHaveBeenCalledTimes(1)
  })

  it('OTA chỉ nhận HTTPS từ host trong OTA_ALLOWED_HOSTS', async () => {
    const { techToken, node } = await onlineNode()
    await send(techToken, node._id, { command: 'OTA', ota: { ...OTA, url: 'http://fw.swiftletcare.vn/a.bin' } }).expect(422)
    const res = await send(techToken, node._id, { command: 'OTA', ota: { ...OTA, url: 'https://evil.example.com/a.bin' } }).expect(400)
    expect(res.body.error.message).toContain('OTA_ALLOWED_HOSTS')
    expect(publishCommand).not.toHaveBeenCalled()
  })

  it('OTA quá 30 phút chưa xác nhận → ota_failed + audit, lần gửi sau xoá cờ lỗi', async () => {
    const { techToken, node } = await onlineNode()
    await send(techToken, node._id, { command: 'OTA', ota: OTA }).expect(202)
    await SensorNode.updateOne({ _id: node._id }, { 'ota_pending.requested_at': new Date(Date.now() - OTA_CONFIRM_TIMEOUT_MS - 1000) })

    expect(await markOtaTimeouts()).toBe(1)
    const failed = (await SensorNode.findById(node._id))!
    expect(failed.ota_pending).toBeUndefined()
    expect(failed.ota_failed).toMatchObject({ version: '1.4.1', running_version: '1.4.0' })
    expect(await AuditLog.countDocuments({ action: 'DEVICE_OTA_TIMEOUT' })).toBe(1)
    expect(await markOtaTimeouts()).toBe(0)

    await send(techToken, node._id, { command: 'OTA', ota: OTA }).expect(202)
    expect((await SensorNode.findById(node._id))!.ota_failed).toBeUndefined()
  })

  it('lệnh không tới được broker → 503, không ghi ota_pending', async () => {
    const { techToken, node } = await onlineNode()
    ;(publishCommand as jest.Mock).mockReturnValue(false)

    const res = await send(techToken, node._id, { command: 'OTA', ota: OTA }).expect(503)
    expect(res.body.error.message).toContain('MQTT')
    expect((await SensorNode.findById(node._id))!.ota_pending).toBeUndefined()
    await send(techToken, node._id, { command: 'RESTART' }).expect(503)
  })

  it('thiết bị DEGRADED vẫn nhận được lệnh, PENDING/OFFLINE thì không', async () => {
    const { techToken, node } = await onlineNode()
    await SensorNode.updateOne({ _id: node._id }, { status: 'DEGRADED' })
    await send(techToken, node._id, { command: 'RESTART' }).expect(202)

    await SensorNode.updateOne({ _id: node._id }, { status: 'ERROR' })
    await send(techToken, node._id, { command: 'RESTART' }).expect(409)
  })
  it('firmware trước 1.4.0 chưa xử lý RESTART/OTA → 501, PUSH_CONFIG vẫn chạy', async () => {
    const { techToken, node, a } = await onlineNode()
    for (const version of ['1.3.0', '1.4.0-beta']) {
      await SensorNode.updateOne({ _id: node._id }, { firmware_version: version })
      const restart = await send(techToken, node._id, { command: 'RESTART' }).expect(501)
      expect(restart.body.error.message).toContain('chưa xử lý lệnh RESTART')
      await send(techToken, node._id, { command: 'OTA', ota: OTA }).expect(501)
    }
    expect(publishCommand).not.toHaveBeenCalled()

    // PUSH_CONFIG không phụ thuộc trường `command` nên firmware cũ vẫn hiểu
    await send(techToken, node._id, { command: 'PUSH_CONFIG' }).expect(202)
    expect((publishCommand as jest.Mock).mock.calls[0][2]).toBe(String(a.zone._id))

    // Bản mới hơn 1.4.0 (kể cả 1.10.0, so theo số chứ không theo chuỗi) thì gửi được
    await SensorNode.updateOne({ _id: node._id }, { firmware_version: '1.10.0' })
    await send(techToken, node._id, { command: 'RESTART' }).expect(202)
  })
})

describe('gỡ thiết bị thì dọn cảnh báo của nó (FARM-FR-008)', () => {
  it('cảnh báo còn mở chuyển RESOLVED và không bị gửi lại', async () => {
    const { techToken, a, secretKey } = await seed()
    const nodeId = (await register(techToken, { device_id: 'node_100', zone_id: String(a.zone._id), secret_key: secretKey }).expect(201)).body.data._id

    const stale = new Date(Date.now() - 2 * 60 * 60_000) // quá ngưỡng gửi lại NODE_OFFLINE (1 giờ)
    const alert = await Alert.create({
      farm_id: a.farm._id, zone_id: a.zone._id, node_id: nodeId, type: 'NODE_OFFLINE', severity: 'HIGH',
      title: 'Mất kết nối', message: 'x', status: 'ACTIVE', created_at: stale,
    })

    await request(app).post(`/devices/sensor-nodes/${nodeId}/decommission`)
      .set('Authorization', `Bearer ${techToken}`).send({ reason: 'Thiết bị chết, thu hồi' }).expect(200)

    expect((await Alert.findById(alert._id))!.status).toBe('RESOLVED')
    expect((await Alert.findById(alert._id))!.resolved_at).toBeInstanceOf(Date)

    const audit = await AuditLog.findOne({ action: 'DEVICE_DECOMMISSIONED' }).lean()
    expect(audit!.metadata).toMatchObject({ closedAlerts: 1 })

    // Cảnh báo cũ còn sót của thiết bị đã gỡ cũng không được gửi lại (ALERT-FR-015)
    await Alert.updateOne({ _id: alert._id }, { status: 'ACTIVE' })
    expect(await renotifyStaleAlerts()).toBe(0)
  })

})

describe('thiết bị đã gỡ không còn nhận lệnh (FARM-FR-008)', () => {
  it('gỡ thiết bị trả override về AUTO; lịch loa/relay-override bị chặn; job hết hạn override bỏ qua', async () => {
    const { techToken, ownerToken, a } = await seed()
    const node = await SensorNode.create({
      device_id: 'node_300', zone_id: a.zone._id, status: 'ONLINE',
      control_mode: 'MANUAL', override_expiry: new Date(Date.now() + 10 * 60_000),
    })

    // Thiết bị đang ONLINE nên phải xác nhận bằng force (xem decommissionDevice)
    await request(app).post(`/devices/sensor-nodes/${node._id}/decommission`)
      .set('Authorization', `Bearer ${techToken}`).send({ reason: 'Hỏng nguồn', force: true }).expect(200)
    const removed = (await SensorNode.findById(node._id))!
    expect(removed.control_mode).toBe('AUTO')
    expect(removed.override_expiry).toBeUndefined()

    await request(app).put(`/devices/sensor-nodes/${node._id}/speaker-schedule`)
      .set('Authorization', `Bearer ${ownerToken}`).send({ enabled: false }).expect(409)
    await request(app).delete(`/devices/sensor-nodes/${node._id}/relay-override`)
      .set('Authorization', `Bearer ${ownerToken}`).expect(409)

    // Dữ liệu cũ còn MANUAL quá hạn trên node đã gỡ: không được bắn clear_override lên topic Zone
    await SensorNode.updateOne({ _id: node._id }, { control_mode: 'MANUAL', override_expiry: new Date(Date.now() - 60_000) })
    jest.clearAllMocks()
    expect(await expireManualOverrides()).toBe(0)
    expect(publishCommand).not.toHaveBeenCalled()
  })
})

describe('dời zone (FARM-FR-007b)', () => {
  it('đóng cảnh báo còn mở ở farm cũ và gửi reassign kèm deviceId', async () => {
    const { techToken, a, b } = await seed()
    const node = await SensorNode.create({ device_id: 'node_400', zone_id: a.zone._id, status: 'ONLINE' })
    const alert = await Alert.create({
      farm_id: a.farm._id, zone_id: a.zone._id, node_id: node._id, type: 'SPEAKER_FAILURE', severity: 'HIGH',
      title: 'Loa hỏng', message: 'x', status: 'ACTIVE',
    })

    await request(app).put(`/devices/sensor-nodes/${node._id}/reassign-zone`)
      .set('Authorization', `Bearer ${techToken}`).send({ newZoneId: String(b.zone._id) }).expect(200)

    expect((await Alert.findById(alert._id))!.status).toBe('RESOLVED')
    expect((publishCommand as jest.Mock).mock.calls.at(-1)![4]).toMatchObject({ deviceId: 'node_400', newZoneId: String(b.zone._id) })
  })

  const reassign = (token: string, nodeId: unknown, newZoneId: unknown) =>
    request(app).put(`/devices/sensor-nodes/${nodeId}/reassign-zone`)
      .set('Authorization', `Bearer ${token}`).send({ newZoneId: String(newZoneId) })

  it('không cho dời về chính Zone đang ở (thiết bị sẽ khởi động lại vô ích)', async () => {
    const { techToken, a } = await seed()
    const node = await SensorNode.create({ device_id: 'node_401', zone_id: a.zone._id, status: 'ONLINE' })
    await reassign(techToken, node._id, a.zone._id).expect(400)
    expect(publishCommand).not.toHaveBeenCalled()
  })

  it('thiết bị DEGRADED (vẫn kết nối) dời được như lệnh từ xa, OFFLINE thì không', async () => {
    const { techToken, a, b } = await seed()
    const degraded = await SensorNode.create({ device_id: 'node_402', zone_id: a.zone._id, status: 'DEGRADED' })
    await reassign(techToken, degraded._id, b.zone._id).expect(200)

    const offline = await SensorNode.create({ device_id: 'node_403', zone_id: a.zone._id, status: 'OFFLINE' })
    const res = await reassign(techToken, offline._id, b.zone._id).expect(409)
    expect(res.body.error.message).toContain('OFFLINE')
  })
})

describe('farm: sửa và xoá farm (FARM-FR-001)', () => {
  async function farmWithCoOwner() {
    const primary = await User.create({ email: 'p@test.vn', password_hash: 'password123', full_name: 'P', role: 'FARM_OWNER' })
    const coOwner = await User.create({ email: 'c@test.vn', password_hash: 'password123', full_name: 'C', role: 'FARM_OWNER' })
    const farm = await Farm.create({
      name: 'F', address: 'x', owner_id: primary._id,
      members: [{ user_id: primary._id, is_primary: true }, { user_id: coOwner._id }],
    })
    const as = (u: { _id: unknown; email: string }) => ({ _id: String(u._id), email: u.email, role: 'FARM_OWNER' as const })
    return { farm, primary: as(primary), coOwner: as(coOwner) }
  }

  it('đồng sở hữu sửa được tên và tọa độ', async () => {
    const { farm, coOwner } = await farmWithCoOwner()

    await updateFarm(String(farm._id), coOwner, { name: 'Tên mới', coordinates: { lat: 10.5, lng: 106.5 } })

    const saved = (await Farm.findById(farm._id))!
    expect([saved.name, saved.coordinates]).toEqual(['Tên mới', { lat: 10.5, lng: 106.5 }])
  })

  it('xoá farm đóng cảnh báo đang mở và không sinh cảnh báo mới cho farm đó', async () => {
    const { farm, primary } = await farmWithCoOwner()
    const open = await Alert.create({
      farm_id: farm._id, type: 'POWER_OUTAGE', severity: 'HIGH', title: 'Mất điện', message: 'x', status: 'ACTIVE',
    })

    await removeFarm(String(farm._id), primary)

    expect((await Alert.findById(open._id))!.status).toBe('RESOLVED')
    expect(await createAlert({ farmId: String(farm._id), type: 'NODE_OFFLINE', title: 't', message: 'm' })).toBeNull()
  })
})
