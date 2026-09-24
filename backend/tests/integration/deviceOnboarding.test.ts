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
import { Alert } from '@/models/alert.model'
import { Ticket } from '@/models/ticket.model'
import { createTicketsFromStaleAlerts } from '@/services/ticket.service'
import { createAlert } from '@/services/alert.service'
import { removeFarm, updateFarm } from '@/services/farm.service'
import { publishCommand } from '@/mqtt/mqtt.client'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
process.env.OTA_ALLOWED_HOSTS = 'fw.swiftletcare.vn'
// Firmware thật chưa xử lý `command`; bật cờ để test đúng phần backend (xem device.service.ts)
process.env.FIRMWARE_COMMAND_SUPPORT = 'true'

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
    Ticket.deleteMany({}), Alert.deleteMany({}),
  ])
  jest.clearAllMocks()
  ;(publishCommand as jest.Mock).mockReturnValue(true)
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
    // Camera chưa có kênh heartbeat (ai-pipeline chưa deploy) nên không bị báo quá hạn
    await CameraNode.create({ device_id: 'cam_late', zone_id: a.zone._id, registered_at: old, registered_by: tech._id })

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
    const { techToken, nodeId } = await installed()
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, {}).expect(422)
    await post(`/devices/sensor-nodes/${nodeId}/decommission`, techToken, { reason: 'Hỏng nguồn' }).expect(200)

    const node = (await SensorNode.findById(nodeId))!
    expect(node.decommissioned_at).toBeInstanceOf(Date)
    const list = await request(app).get('/devices/sensor-nodes').set('Authorization', `Bearer ${techToken}`).expect(200)
    expect(list.body.data).toHaveLength(0)

    await expect(recordHeartbeat({ deviceId: 'node_100' } as never)).rejects.toThrow()
    await post(`/devices/sensor-nodes/${nodeId}/relay`, techToken, { relayName: 'misting', state: true }).expect(409)
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
})

describe('POST /devices/sensor-nodes/:id/commands (TICKET-FR-008, Flow 15)', () => {
  const OTA = { version: '1.3.0', url: 'https://fw.swiftletcare.vn/esp32-1.3.0.bin', sha256: 'a'.repeat(64) }
  const send = (token: string, id: unknown, body: object) =>
    request(app).post(`/devices/sensor-nodes/${id}/commands`).set('Authorization', `Bearer ${token}`).send(body)

  async function onlineNode() {
    const ctx = await seed()
    const node = await SensorNode.create({ device_id: 'node_100', zone_id: ctx.a.zone._id, status: 'ONLINE', firmware_version: '1.2.4' })
    return { ...ctx, node }
  }

  it('PUSH_CONFIG đẩy ngưỡng hiện hành của Zone qua config/update', async () => {
    const { techToken, node, a } = await onlineNode()
    await send(techToken, node._id, { command: 'PUSH_CONFIG' }).expect(202)
    const [, , zoneId, topic, payload] = (publishCommand as jest.Mock).mock.calls[0]
    expect([zoneId, topic]).toEqual([String(a.zone._id), 'config/update'])
    expect(payload).toMatchObject({ temp_min: expect.any(Number), co2_max: expect.any(Number) })
  })

  it('OTA: validate đầu vào, lưu ota_pending, heartbeat đúng version thì xác nhận thành công', async () => {
    const { techToken, node } = await onlineNode()
    await send(techToken, node._id, { command: 'OTA', ota: { ...OTA, sha256: 'xyz' } }).expect(422)
    await send(techToken, node._id, { command: 'OTA', ota: { ...OTA, version: '1.2.4' } }).expect(409)

    await send(techToken, node._id, { command: 'OTA', ota: OTA }).expect(202)
    expect((publishCommand as jest.Mock).mock.calls[0][4]).toEqual({ deviceId: node.device_id, command: 'OTA', ota: OTA })
    expect((await SensorNode.findById(node._id))!.ota_pending!.version).toBe('1.3.0')

    await recordHeartbeat({ deviceId: 'node_100', firmwareVersion: '1.2.4' } as never) // chưa lên bản mới
    expect((await SensorNode.findById(node._id))!.ota_pending).toBeDefined()
    await recordHeartbeat({ deviceId: 'node_100', firmwareVersion: '1.3.0' } as never)
    const done = (await SensorNode.findById(node._id))!
    expect(done.ota_pending).toBeUndefined()
    expect(done.firmware_version).toBe('1.3.0')
    expect(await AuditLog.countDocuments({ action: 'DEVICE_OTA_SUCCEEDED' })).toBe(1)
  })

  it('gắn vào ticket cùng farm thì ghi note; thiết bị OFFLINE hoặc ticket farm khác bị từ chối', async () => {
    const { techToken, node, a, b, tech } = await onlineNode()
    const ticket = await Ticket.create({ farm_id: a.farm._id, type: 'NODE_OFFLINE', priority: 'P2', assigned_to: tech._id })
    await send(techToken, node._id, { command: 'RESTART', ticket_id: String(ticket._id) }).expect(202)
    const note = (await Ticket.findById(ticket._id))!.notes.at(-1)!.content
    expect(note).toContain('khởi động lại')
    expect(note).toContain('chờ thiết bị xác nhận') // không khẳng định thiết bị đã thực thi

    const other = await Ticket.create({ farm_id: b.farm._id, type: 'OTHER', priority: 'P3', assigned_to: tech._id })
    const notMine = await Ticket.create({ farm_id: a.farm._id, type: 'OTHER', priority: 'P3' })
    await send(techToken, node._id, { command: 'RESTART', ticket_id: String(notMine._id) }).expect(403)
    await send(techToken, node._id, { command: 'RESTART', ticket_id: String(other._id) }).expect(400)

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
    expect(failed.ota_failed).toMatchObject({ version: '1.3.0', running_version: '1.2.4' })
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
  it('chưa bật FIRMWARE_COMMAND_SUPPORT thì RESTART/OTA trả 501, PUSH_CONFIG vẫn chạy', async () => {
    const { techToken, node, a } = await onlineNode()
    process.env.FIRMWARE_COMMAND_SUPPORT = 'false'
    try {
      const restart = await send(techToken, node._id, { command: 'RESTART' }).expect(501)
      expect(restart.body.error.message).toContain('chưa xử lý lệnh RESTART')
      await send(techToken, node._id, { command: 'OTA', ota: OTA }).expect(501)
      expect(publishCommand).not.toHaveBeenCalled()

      // PUSH_CONFIG không phụ thuộc trường `command` nên firmware cũ vẫn hiểu
      await send(techToken, node._id, { command: 'PUSH_CONFIG' }).expect(202)
      expect((publishCommand as jest.Mock).mock.calls[0][2]).toBe(String(a.zone._id))
    } finally {
      process.env.FIRMWARE_COMMAND_SUPPORT = 'true'
    }
  })
})

describe('heartbeat đầu tiên đẩy ngưỡng của Zone xuống thiết bị (Flow 1 bước 9)', () => {
  it('đẩy đúng ngưỡng Zone 1 lần, lần sau không đẩy lại', async () => {
    const { techToken, a, secretKey } = await seed()
    await Zone.updateOne({ _id: a.zone._id }, { 'thresholds.temp_min': 28, 'thresholds.temp_max': 30 })
    await register(techToken, { device_id: 'node_100', zone_id: String(a.zone._id), secret_key: secretKey }).expect(201)

    await recordHeartbeat({ deviceId: 'node_100' } as never)
    const [, , zoneId, topic, payload] = (publishCommand as jest.Mock).mock.calls[0]
    expect([zoneId, topic]).toEqual([String(a.zone._id), 'config/update'])
    expect(payload).toMatchObject({ temp_min: 28, temp_max: 30 })
    expect((await SensorNode.findOne({ device_id: 'node_100' }))!.config_pushed_at).toBeInstanceOf(Date)

    ;(publishCommand as jest.Mock).mockClear()
    await recordHeartbeat({ deviceId: 'node_100' } as never)
    expect(publishCommand).not.toHaveBeenCalled()
  })
})

describe('gỡ thiết bị thì dọn cảnh báo của nó (FARM-FR-008)', () => {
  it('cảnh báo còn mở chuyển RESOLVED, ticket đang mở được ghi chú, không sinh ticket rác', async () => {
    const { techToken, a, secretKey } = await seed()
    const nodeId = (await register(techToken, { device_id: 'node_100', zone_id: String(a.zone._id), secret_key: secretKey }).expect(201)).body.data._id

    const stale = new Date(Date.now() - 2 * 60 * 60_000) // quá ngưỡng ticket NODE_OFFLINE (1 giờ)
    const alert = await Alert.create({
      farm_id: a.farm._id, zone_id: a.zone._id, node_id: nodeId, type: 'NODE_OFFLINE', severity: 'HIGH',
      title: 'Mất kết nối', message: 'x', status: 'ACTIVE', created_at: stale,
    })
    const ticket = await Ticket.create({ farm_id: a.farm._id, alert_id: alert._id, type: 'NODE_OFFLINE', priority: 'P2' })

    await request(app).post(`/devices/sensor-nodes/${nodeId}/decommission`)
      .set('Authorization', `Bearer ${techToken}`).send({ reason: 'Thiết bị chết, thu hồi' }).expect(200)

    expect((await Alert.findById(alert._id))!.status).toBe('RESOLVED')
    expect((await Alert.findById(alert._id))!.resolved_at).toBeInstanceOf(Date)
    expect((await Ticket.findById(ticket._id))!.notes.at(-1)!.content).toContain('đã được gỡ khỏi hệ thống')

    const audit = await AuditLog.findOne({ action: 'DEVICE_DECOMMISSIONED' }).lean()
    expect(audit!.metadata).toMatchObject({ closedAlerts: 1, notedTickets: 1 })

    // Cảnh báo cũ còn sót của thiết bị đã gỡ cũng không được biến thành ticket
    await Alert.updateOne({ _id: alert._id }, { status: 'ACTIVE' })
    expect(await createTicketsFromStaleAlerts()).toBe(0)
  })

})

describe('ticket tự động khi thiết bị mất kết nối (TICKET-FR-002)', () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

  async function offlineNode() {
    const { a } = await seed()
    const node = await SensorNode.create({ device_id: 'node_200', zone_id: a.zone._id, status: 'OFFLINE' })
    const offlineAlert = (created_at: Date, status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' = 'ACTIVE') => Alert.create({
      farm_id: a.farm._id, zone_id: a.zone._id, node_id: node._id, type: 'NODE_OFFLINE', severity: 'HIGH',
      title: 'Mất kết nối', message: 'x', status, created_at,
    })
    return { a, offlineAlert }
  }

  it('chỉ tạo ticket khi mất kết nối liên tục quá 1 giờ, và chỉ 1 lần cho mỗi lần mất kết nối', async () => {
    const { offlineAlert } = await offlineNode()
    const alert = await offlineAlert(minutesAgo(30))
    expect(await createTicketsFromStaleAlerts()).toBe(0)

    await Alert.updateOne({ _id: alert._id }, { created_at: minutesAgo(120) })
    expect(await createTicketsFromStaleAlerts()).toBe(1)
    expect(await createTicketsFromStaleAlerts()).toBe(0)
    expect((await Ticket.findOne({ alert_id: alert._id }))!.notes[0].content).toContain('mất kết nối liên tục hơn 1 giờ')
  })

  it('không tạo ticket nếu thiết bị đã ONLINE lại mà cảnh báo chưa kịp đóng (heartbeat tới đúng lúc job chạy)', async () => {
    const { offlineAlert } = await offlineNode()
    await offlineAlert(minutesAgo(120))
    await SensorNode.updateOne({ device_id: 'node_200' }, { status: 'ONLINE' })

    expect(await createTicketsFromStaleAlerts()).toBe(0)
    expect(await Ticket.countDocuments()).toBe(0)
  })

  it('vẫn tạo ticket khi chủ trại đã xác nhận nhưng thiết bị vẫn offline', async () => {
    const { offlineAlert } = await offlineNode()
    await offlineAlert(minutesAgo(120), 'ACKNOWLEDGED')
    expect(await createTicketsFromStaleAlerts()).toBe(1)
  })

  it('mất kết nối lại khi ticket cũ còn mở thì ghi chú vào ticket cũ, không tạo ticket mới', async () => {
    const { a, offlineAlert } = await offlineNode()
    const first = await offlineAlert(minutesAgo(300), 'RESOLVED')
    const ticket = await Ticket.create({ farm_id: a.farm._id, alert_id: first._id, type: 'NODE_OFFLINE', priority: 'P2' })
    const second = await offlineAlert(minutesAgo(90))

    expect(await createTicketsFromStaleAlerts()).toBe(0)
    const updated = (await Ticket.findById(ticket._id))!
    expect(String(updated.alert_id)).toBe(String(second._id))
    expect(updated.notes.at(-1)!.content).toContain('mất kết nối lại')

    expect(await createTicketsFromStaleAlerts()).toBe(0)
    expect((await Ticket.findById(ticket._id))!.notes).toHaveLength(updated.notes.length)
    expect(await Ticket.countDocuments()).toBe(1)
  })

  it('ticket cũ đã đóng thì lần mất kết nối mới được ticket riêng', async () => {
    const { a, offlineAlert } = await offlineNode()
    const first = await offlineAlert(minutesAgo(300), 'RESOLVED')
    await Ticket.create({ farm_id: a.farm._id, alert_id: first._id, type: 'NODE_OFFLINE', priority: 'P2', status: 'CLOSED' })
    await offlineAlert(minutesAgo(90))

    expect(await createTicketsFromStaleAlerts()).toBe(1)
    expect(await Ticket.countDocuments()).toBe(2)
  })

  it('cảnh báo HIGH loại khác vẫn sinh ticket sau 15 phút như cũ', async () => {
    const { a } = await offlineNode()
    await Alert.create({
      farm_id: a.farm._id, zone_id: a.zone._id, type: 'POWER_OUTAGE', severity: 'HIGH',
      title: 'Mất điện', message: 'x', status: 'ACTIVE', created_at: minutesAgo(20),
    })
    expect(await createTicketsFromStaleAlerts()).toBe(1)
  })
})

describe('thiết bị đã gỡ không còn nhận lệnh (FARM-FR-008)', () => {
  it('gỡ thiết bị trả override về AUTO; lịch loa/relay-override bị chặn; job hết hạn override bỏ qua', async () => {
    const { techToken, a } = await seed()
    const node = await SensorNode.create({
      device_id: 'node_300', zone_id: a.zone._id, status: 'ONLINE',
      control_mode: 'MANUAL', override_expiry: new Date(Date.now() + 10 * 60_000),
    })

    await request(app).post(`/devices/sensor-nodes/${node._id}/decommission`)
      .set('Authorization', `Bearer ${techToken}`).send({ reason: 'Hỏng nguồn' }).expect(200)
    const removed = (await SensorNode.findById(node._id))!
    expect(removed.control_mode).toBe('AUTO')
    expect(removed.override_expiry).toBeUndefined()

    await request(app).put(`/devices/sensor-nodes/${node._id}/speaker-schedule`)
      .set('Authorization', `Bearer ${techToken}`).send({ enabled: false }).expect(409)
    await request(app).delete(`/devices/sensor-nodes/${node._id}/relay-override`)
      .set('Authorization', `Bearer ${techToken}`).expect(409)

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
})

describe('farm: quyền đổi region và xoá farm (FARM-FR-001)', () => {
  async function farmWithCoOwner() {
    const primary = await User.create({ email: 'p@test.vn', password_hash: 'password123', full_name: 'P', role: 'FARM_OWNER' })
    const coOwner = await User.create({ email: 'c@test.vn', password_hash: 'password123', full_name: 'C', role: 'FARM_OWNER' })
    const farm = await Farm.create({
      name: 'F', address: 'x', region: 'HCMC', owner_id: primary._id,
      members: [{ user_id: primary._id, is_primary: true }, { user_id: coOwner._id }],
    })
    const as = (u: { _id: unknown; email: string }) => ({ _id: String(u._id), email: u.email, role: 'FARM_OWNER' as const })
    return { farm, primary: as(primary), coOwner: as(coOwner) }
  }

  it('đồng sở hữu sửa được tên nhưng không đổi được region; Primary Owner thì được', async () => {
    const { farm, primary, coOwner } = await farmWithCoOwner()

    await updateFarm(String(farm._id), coOwner, { name: 'Tên mới', region: 'HCMC' }) // gửi lại region cũ vẫn OK
    await expect(updateFarm(String(farm._id), coOwner, { region: 'Hanoi' })).rejects.toThrow('Primary Owner')
    await updateFarm(String(farm._id), primary, { region: 'Hanoi' })

    const saved = (await Farm.findById(farm._id))!
    expect([saved.name, saved.region]).toEqual(['Tên mới', 'Hanoi'])
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
