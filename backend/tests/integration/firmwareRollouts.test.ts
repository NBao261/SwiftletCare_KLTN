import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import adminRoutes from '@/routes/admin.route'
import deviceRoutes from '@/routes/devices.route'
import firmwareRoutes from '@/routes/firmware.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { FirmwareImage } from '@/models/firmwareImage.model'
import { FirmwareRollout } from '@/models/firmwareRollout.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { publishDeviceCommand } from '@/mqtt/mqtt.client'
import { markOtaTimeouts, recordHeartbeat } from '@/services/device.service'
import { uploadFirmwareImage } from '@/services/firmwareImage.service'
import { sweepRollouts } from '@/services/firmwareRollout.service'
import { notifyUser } from '@/services/notification.service'
import { APP_OFFSET, BOOTLOADER_OFFSET, OTA_CONFIRM_TIMEOUT_MS } from '@/utils/firmwareImage.util'
import type { HeartbeatPayload } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
const BASE = 'https://api.swiftletcare.test/api'

const app = express()
app.use(express.json())
app.use('/admin', adminRoutes)
app.use('/devices', deviceRoutes)
app.use('/firmware', firmwareRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer
let storageDir: string
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fw-rollouts-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.LOCAL_STORAGE_DIR = storageDir
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
  await fs.rm(storageDir, { recursive: true, force: true })
  delete process.env.STORAGE_DRIVER
  delete process.env.LOCAL_STORAGE_DIR
})
beforeEach(() => { process.env.OTA_DOWNLOAD_BASE_URL = BASE })
afterEach(async () => {
  await Promise.all([AuditLog, SensorNode, Farm, FirmwareImage, FirmwareRollout, House, Zone, User].map(m => (m as typeof User).deleteMany({})))
  jest.clearAllMocks()
  ;(publishDeviceCommand as jest.Mock).mockReturnValue(true)
})

function factoryImage(version: string): Buffer {
  const buffer = Buffer.alloc(APP_OFFSET + 4096, 0xFF)
  buffer[BOOTLOADER_OFFSET] = 0xE9
  buffer[APP_OFFSET] = 0xE9
  buffer.write(`SwiftletCare ESP32 Firmware v${version}     `, APP_OFFSET + 100, 'utf8')
  return buffer
}

async function seed() {
  const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'A', role: 'ADMIN' })
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Z' })
  const node = (deviceId: string, status: 'ONLINE' | 'OFFLINE', firmware = '2.4.0') =>
    SensorNode.create({ device_id: deviceId, zone_id: zone._id, status, firmware_version: firmware })
  const image = await uploadFirmwareImage(String(admin._id), { version: '2.5.0' }, { buffer: factoryImage('2.5.0') })
  const token = jwt.sign({ sub: String(admin._id), role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  const ownerToken = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  return { admin, owner, node, image, token, ownerToken }
}

const create = (token: string, body: object) =>
  request(app).post('/admin/firmware-rollouts').set('Authorization', `Bearer ${token}`).send(body)
const act = (token: string, id: string, action: string) =>
  request(app).post(`/admin/firmware-rollouts/${id}/${action}`).set('Authorization', `Bearer ${token}`)
const heartbeat = (deviceId: string, firmwareVersion: string) =>
  recordHeartbeat({ deviceId, firmwareVersion, justConnected: true } as HeartbeatPayload)
const states = async (id: string) =>
  Object.fromEntries((await FirmwareRollout.findById(id).lean())!.targets.map(t => [t.device_id, t.state]))

// URL của lệnh OTA gửi cho máy `deviceId` gần nhất
function sentUrl(deviceId: string): string {
  const calls = (publishDeviceCommand as jest.Mock).mock.calls.filter(([id, type]) => id === deviceId && type === 'OTA')
  return (calls[calls.length - 1][2] as { url: string }).url
}

describe('đợt cập nhật firmware từ xa (FARM-FR-013b)', () => {
  it('máy thử trước, rồi các máy còn lại; máy offline nhận khi online lại; xong thì báo người tạo', async () => {
    const { admin, owner, node, image, token } = await seed()
    const canary = await node('ctl-a', 'ONLINE')
    const offline = await node('ctl-b', 'OFFLINE')
    const online = await node('ctl-c', 'ONLINE')

    const res = await create(token, {
      image_id: image._id, node_ids: [canary._id, offline._id, online._id].map(String), canary_node_ids: [String(canary._id)], note: 'Sửa lỗi',
    }).expect(201)
    const id = res.body.data._id as string
    expect(res.body.data).toMatchObject({ version: '2.5.0', status: 'ACTIVE', stage: 'CANARY' })
    expect(JSON.stringify(res.body.data)).not.toContain('token_hash')
    expect(await states(id)).toEqual({ 'ctl-a': 'SENT', 'ctl-b': 'QUEUED', 'ctl-c': 'QUEUED' })

    // Lệnh mang phần firmware (từ 0x10000) và link tải riêng cho máy
    const app0 = factoryImage('2.5.0').subarray(APP_OFFSET)
    const command = (publishDeviceCommand as jest.Mock).mock.calls[0]
    expect(command[2]).toMatchObject({ version: '2.5.0', sha256: crypto.createHash('sha256').update(app0).digest('hex') })
    const url = sentUrl('ctl-a')
    expect(url).toMatch(new RegExp(`^${BASE}/firmware/ota/[0-9a-f]{64}$`))
    const file = await request(app).get(url.slice(BASE.length)).buffer(true).parse((r, done) => {
      const chunks: Buffer[] = []
      r.on('data', (c: Buffer) => chunks.push(c))
      r.on('end', () => done(null, Buffer.concat(chunks)))
    }).expect(200)
    expect(Buffer.compare(file.body as Buffer, app0)).toBe(0)
    expect(file.headers['content-length']).toBe(String(app0.length))
    await request(app).get(`/firmware/ota/${'0'.repeat(64)}`).expect(404)
    expect((await SensorNode.findById(canary._id))!.ota_pending!.url).not.toContain(url.slice(-64))

    // Máy thử lên bản mới → tới lượt các máy còn lại; máy offline vẫn chờ
    await heartbeat('ctl-a', '2.5.0')
    expect(await states(id)).toEqual({ 'ctl-a': 'SUCCEEDED', 'ctl-b': 'QUEUED', 'ctl-c': 'SENT' })
    expect((await FirmwareRollout.findById(id).lean())!.stage).toBe('ALL')
    // Link của máy đã xong không dùng được nữa
    await request(app).get(url.slice(BASE.length)).expect(404)

    await SensorNode.updateOne({ _id: offline._id }, { status: 'OFFLINE' })
    await heartbeat('ctl-b', '2.4.0')
    expect(await states(id)).toMatchObject({ 'ctl-b': 'SENT' })

    await heartbeat('ctl-b', '2.5.0')
    await heartbeat('ctl-c', '2.5.0')
    const done = (await FirmwareRollout.findById(id).lean())!
    expect(done.status).toBe('COMPLETED')
    expect(done.finished_at).toBeDefined()
    const titles = (notifyUser as jest.Mock).mock.calls.map(([to, n]) => [String(to), (n as { title: string }).title])
    expect(titles).toContainEqual([String(admin._id), 'Đợt cập nhật firmware 2.5.0 đã xong'])
    expect(titles.filter(([to]) => to === String(owner._id))).toHaveLength(3)
    expect(await AuditLog.countDocuments({ action: 'FIRMWARE_ROLLOUT_CREATED' })).toBe(1)
    expect(await AuditLog.countDocuments({ action: 'DEVICE_COMMAND_SENT' })).toBe(3)
  })

  it('máy lỗi quá hạn: đợt tự dừng, báo người tạo; thử lại thì gửi lại và đợt chạy tiếp', async () => {
    const { admin, node, image, token } = await seed()
    const a = await node('ctl-a', 'ONLINE')
    const b = await node('ctl-b', 'OFFLINE')
    const id = (await create(token, { image_id: image._id, node_ids: [String(a._id), String(b._id)] }).expect(201)).body.data._id as string

    await SensorNode.updateOne({ _id: a._id }, { 'ota_pending.requested_at': new Date(Date.now() - OTA_CONFIRM_TIMEOUT_MS - 1000) })
    await markOtaTimeouts()
    const paused = (await FirmwareRollout.findById(id).lean())!
    expect(paused).toMatchObject({ status: 'PAUSED', paused_reason: 'FAILURE' })
    expect(paused.targets[0]).toMatchObject({ state: 'FAILED', reason: 'TIMEOUT' })
    const notes = (notifyUser as jest.Mock).mock.calls.filter(([to]) => String(to) === String(admin._id))
    expect(notes).toHaveLength(1)
    expect((notes[0][1] as { title: string }).title).toBe('Đợt cập nhật firmware 2.5.0 đã tạm dừng')

    // Đợt dừng: máy offline online lại cũng không nhận
    await SensorNode.updateOne({ _id: b._id }, { status: 'OFFLINE' })
    await heartbeat('ctl-b', '2.4.0')
    expect(await states(id)).toMatchObject({ 'ctl-b': 'QUEUED' })

    const retried = await request(app).post(`/admin/firmware-rollouts/${id}/targets/${a._id}/retry`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(retried.body.data.status).toBe('ACTIVE')
    expect(retried.body.data.targets[0]).toMatchObject({ state: 'SENT', attempts: 2 })
    expect(retried.body.data.targets[1].state).toBe('SENT')
    await request(app).post(`/admin/firmware-rollouts/${id}/targets/${b._id}/retry`).set('Authorization', `Bearer ${token}`).expect(409)
  })

  it('dừng, tiếp tục, gửi tất cả ngay, huỷ; bản đang dùng không xoá được', async () => {
    const { node, image, token } = await seed()
    const a = await node('ctl-a', 'OFFLINE')
    const b = await node('ctl-b', 'ONLINE')
    const c = await node('ctl-c', 'OFFLINE')
    const id = (await create(token, {
      image_id: image._id, node_ids: [a, b, c].map(n => String(n._id)), canary_node_ids: [String(a._id)],
    }).expect(201)).body.data._id as string
    expect(await states(id)).toEqual({ 'ctl-a': 'QUEUED', 'ctl-b': 'QUEUED', 'ctl-c': 'QUEUED' })

    await act(token, id, 'pause').expect(200)
    await act(token, id, 'pause').expect(409)
    await act(token, id, 'promote').expect(200)
    expect(await states(id)).toMatchObject({ 'ctl-b': 'QUEUED' })
    await act(token, id, 'resume').expect(200)
    expect(await states(id)).toMatchObject({ 'ctl-b': 'SENT' })
    await act(token, id, 'promote').expect(409)

    await request(app).delete(`/admin/firmware-images/${image._id}`).set('Authorization', `Bearer ${token}`).expect(409)

    const cancelled = await act(token, id, 'cancel').expect(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
    expect(await states(id)).toEqual({ 'ctl-a': 'CANCELLED', 'ctl-b': 'SENT', 'ctl-c': 'CANCELLED' })
    // Máy đang tải vẫn ghi kết quả
    await heartbeat('ctl-b', '2.5.0')
    expect(await states(id)).toMatchObject({ 'ctl-b': 'SUCCEEDED' })
    await act(token, id, 'resume').expect(409)
    await request(app).delete(`/admin/firmware-images/${image._id}`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(await AuditLog.countDocuments({ action: /^FIRMWARE_ROLLOUT_/ })).toBe(5)
  })

  it('chọn máy: từ chối firmware quá cũ, đã đúng bản, đang trong đợt khác; lệnh OTA gửi tay bị chặn', async () => {
    const { node, image, token, ownerToken } = await seed()
    const old = await node('ctl-old', 'ONLINE', '1.3.0')
    const same = await node('ctl-same', 'ONLINE', '2.5.0')
    const a = await node('ctl-a', 'OFFLINE')

    const tooOld = await create(token, { image_id: image._id, node_ids: [String(old._id), String(same._id)] }).expect(409)
    expect(tooOld.body.error.message).toContain('ctl-old')
    expect(tooOld.body.error.message).toContain('ctl-same')
    await create(token, { image_id: image._id, node_ids: [String(a._id)], canary_node_ids: [String(old._id)] }).expect(400)
    await create(token, { image_id: image._id, node_ids: [] }).expect(422)
    await create(ownerToken, { image_id: image._id, node_ids: [String(a._id)] }).expect(403)

    await create(token, { image_id: image._id, node_ids: [String(a._id)] }).expect(201)
    await create(token, { image_id: image._id, node_ids: [String(a._id)] }).expect(409)

    await SensorNode.updateOne({ _id: a._id }, { status: 'ONLINE' })
    process.env.OTA_ALLOWED_HOSTS = 'fw.swiftletcare.io.vn'
    await request(app).post(`/devices/sensor-nodes/${a._id}/commands`).set('Authorization', `Bearer ${token}`)
      .send({ command: 'OTA', ota: { version: '2.6.0', url: 'https://fw.swiftletcare.io.vn/a.bin', sha256: 'a'.repeat(64) } }).expect(409)
    delete process.env.OTA_ALLOWED_HOSTS

    delete process.env.OTA_DOWNLOAD_BASE_URL
    await create(token, { image_id: image._id, node_ids: [String(same._id)] }).expect(503)
  })

  it('backend mất broker lúc gửi: máy về hàng chờ, job mỗi phút gửi lại; máy bị gỡ thì bỏ qua', async () => {
    const { node, image, token } = await seed()
    const a = await node('ctl-a', 'ONLINE')
    const b = await node('ctl-b', 'OFFLINE')
    ;(publishDeviceCommand as jest.Mock).mockReturnValue(false)
    const id = (await create(token, { image_id: image._id, node_ids: [String(a._id), String(b._id)] }).expect(201)).body.data._id as string
    expect(await states(id)).toEqual({ 'ctl-a': 'QUEUED', 'ctl-b': 'QUEUED' })
    expect((await SensorNode.findById(a._id))!.ota_pending).toBeUndefined()

    ;(publishDeviceCommand as jest.Mock).mockReturnValue(true)
    await SensorNode.updateOne({ _id: b._id }, { decommissioned_at: new Date() })
    await sweepRollouts()
    const rollout = (await FirmwareRollout.findById(id).lean())!
    expect(rollout.targets[0]).toMatchObject({ state: 'SENT', attempts: 1 })
    expect(rollout.targets[1]).toMatchObject({ state: 'SKIPPED', reason: 'NOT_IN_SERVICE' })

    // Link hết hạn thì không tải được
    const url = sentUrl('ctl-a')
    await FirmwareRollout.updateOne({ _id: id }, { 'targets.0.token_expires_at': new Date(Date.now() - 1000) })
    await request(app).get(url.slice(BASE.length)).expect(404)

    const list = await request(app).get('/admin/firmware-rollouts').set('Authorization', `Bearer ${token}`).expect(200)
    expect(list.body.data).toHaveLength(1)
    expect(JSON.stringify(list.body.data)).not.toContain('token_hash')
  })

  it('máy SENT mất dấu ota_pending vẫn bị ghi lỗi; đợt đã huỷ không gửi thêm; thử lại không chen vào đợt khác', async () => {
    const { node, image, token } = await seed()
    const a = await node('ctl-a', 'ONLINE')
    const b = await node('ctl-b', 'OFFLINE')
    const first = (await create(token, { image_id: image._id, node_ids: [String(a._id), String(b._id)] }).expect(201)).body.data._id as string

    // node.save() lỗi sau khi gửi: máy SENT mà không có ota_pending, job OTA không thấy
    await SensorNode.updateOne({ _id: a._id }, { $unset: { ota_pending: '' } })
    await FirmwareRollout.updateOne({ _id: first }, { 'targets.0.sent_at': new Date(Date.now() - OTA_CONFIRM_TIMEOUT_MS - 3 * 60 * 1000) })
    await sweepRollouts()
    const stuck = (await FirmwareRollout.findById(first).lean())!
    expect(stuck).toMatchObject({ status: 'PAUSED', paused_reason: 'FAILURE' })
    expect(stuck.targets[0]).toMatchObject({ state: 'FAILED', reason: 'TIMEOUT' })

    // Huỷ xong thì máy chờ kết nối lại cũng không nhận lệnh
    await act(token, first, 'cancel').expect(200)
    ;(publishDeviceCommand as jest.Mock).mockClear()
    await SensorNode.updateOne({ _id: b._id }, { status: 'OFFLINE' })
    await heartbeat('ctl-b', '2.4.0')
    expect(publishDeviceCommand).not.toHaveBeenCalled()
    await request(app).post(`/admin/firmware-rollouts/${first}/targets/${a._id}/retry`).set('Authorization', `Bearer ${token}`).expect(409)

    // Máy lỗi ở đợt A đã vào đợt B: thử lại ở đợt A bị từ chối
    const second = (await create(token, { image_id: image._id, node_ids: [String(a._id)] }).expect(201)).body.data._id as string
    await FirmwareRollout.updateOne({ _id: second }, { 'targets.0.state': 'FAILED', status: 'PAUSED', paused_reason: 'FAILURE' })
    await SensorNode.updateOne({ _id: a._id }, { $unset: { ota_pending: '' } })
    const third = (await create(token, { image_id: image._id, node_ids: [String(a._id)] }).expect(201)).body.data._id as string
    const busy = await request(app).post(`/admin/firmware-rollouts/${second}/targets/${a._id}/retry`).set('Authorization', `Bearer ${token}`).expect(409)
    expect(busy.body.error.message).toContain('ctl-a')
    expect(await states(third)).toEqual({ 'ctl-a': 'SENT' })
  })

  it('từ chối link tải dài hơn firmware nhận và bản firmware chưa có mã kiểm phần firmware', async () => {
    const { node, image, token } = await seed()
    const a = await node('ctl-a', 'ONLINE')
    process.env.OTA_DOWNLOAD_BASE_URL = `https://${'a'.repeat(170)}.vn`
    const long = await create(token, { image_id: image._id, node_ids: [String(a._id)] }).expect(503)
    expect(long.body.error.message).toContain('255')
    process.env.OTA_DOWNLOAD_BASE_URL = BASE

    await FirmwareImage.updateOne({ _id: image._id }, { $unset: { app_sha256: '' } })
    const old = await create(token, { image_id: image._id, node_ids: [String(a._id)] }).expect(409)
    expect(old.body.error.message).toContain('tải lên lại')
    expect(publishDeviceCommand).not.toHaveBeenCalled()
  })

  it('máy thử lỗi: "Tiếp tục" bị từ chối kèm cách đi tiếp, gửi tất cả rồi tiếp tục thì chạy', async () => {
    const { node, image, token } = await seed()
    const canary = await node('ctl-a', 'ONLINE')
    const other = await node('ctl-b', 'ONLINE')
    const id = (await create(token, {
      image_id: image._id, node_ids: [String(canary._id), String(other._id)], canary_node_ids: [String(canary._id)],
    }).expect(201)).body.data._id as string

    await SensorNode.updateOne({ _id: canary._id }, { 'ota_pending.requested_at': new Date(Date.now() - OTA_CONFIRM_TIMEOUT_MS - 1000) })
    await markOtaTimeouts()
    const refused = await act(token, id, 'resume').expect(409)
    expect(refused.body.error.message).toContain('ctl-a')
    expect((await FirmwareRollout.findById(id).lean())!.status).toBe('PAUSED')

    await act(token, id, 'promote').expect(200)
    await act(token, id, 'resume').expect(200)
    expect(await states(id)).toEqual({ 'ctl-a': 'FAILED', 'ctl-b': 'SENT' })
  })

  it('job quét: máy đã lên đúng bản mà chưa kịp ghi xong thì tính là xong, không ghi lỗi; danh sách có meta', async () => {
    const { node, image, token } = await seed()
    const a = await node('ctl-a', 'ONLINE')
    const id = (await create(token, { image_id: image._id, node_ids: [String(a._id)] }).expect(201)).body.data._id as string
    // Backend khởi động lại sau khi heartbeat ghi bản mới mà trước khi ghi xong đợt
    await SensorNode.updateOne({ _id: a._id }, { firmware_version: '2.5.0', $unset: { ota_pending: '' } })
    await FirmwareRollout.updateOne({ _id: id }, { 'targets.0.sent_at': new Date(Date.now() - OTA_CONFIRM_TIMEOUT_MS - 3 * 60 * 1000) })
    await sweepRollouts()
    const done = (await FirmwareRollout.findById(id).lean())!
    expect(done.targets[0].state).toBe('SUCCEEDED')
    expect(done.status).toBe('COMPLETED')

    const list = await request(app).get('/admin/firmware-rollouts?limit=1').set('Authorization', `Bearer ${token}`).expect(200)
    expect(list.body.meta).toEqual({ total: 1, page: 1, limit: 1 })
    const images = await request(app).get('/admin/firmware-images').set('Authorization', `Bearer ${token}`).expect(200)
    expect(images.body.meta).toMatchObject({ total: 1, page: 1 })
  })
})

