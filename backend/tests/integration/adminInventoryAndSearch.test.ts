/**
 * Admin: thu hồi / cấp lại secretKey cho thiết bị trong kho (FARM-FR-003) và tìm
 * người dùng theo tên/email/SĐT, vùng, trạng thái (AUTH-FR-011).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import adminRoutes from '@/routes/admin.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { User } from '@/models/user.model'
import {
  createProvisionedDevice, revokeProvisionedDevice, rotateProvisionedKey, verifyActivationKey,
} from '@/services/provisionedDevice.service'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
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
    AuditLog.deleteMany({}), ProvisionedDevice.deleteMany({}), SensorNode.deleteMany({}), CameraNode.deleteMany({}), User.deleteMany({}),
  ])
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const mkUser = (email: string, role: Role, extra: object = {}) =>
  User.create({ email, password_hash: 'password123', full_name: email, role, ...extra })

async function provision(deviceId = 'ESP-001') {
  const admin = await mkUser('admin@test.vn', 'ADMIN')
  const created = await createProvisionedDevice(String(admin._id), { device_id: deviceId, kind: 'SENSOR' })
  const doc = (await ProvisionedDevice.findOne({ device_id: deviceId }))!
  return { adminId: String(admin._id), id: String(doc._id), secretKey: created.secret_key }
}

describe('thu hồi thiết bị trong kho', () => {
  it('blocks activation once revoked, telling the reason only to someone holding the right key', async () => {
    const { adminId, id, secretKey } = await provision()

    await revokeProvisionedDevice(adminId, id, '  Mất nhãn ngoài kho  ')

    const doc = (await ProvisionedDevice.findById(id))!
    expect(doc.revoked_at).toBeInstanceOf(Date)
    expect(doc.revoke_reason).toBe('Mất nhãn ngoài kho')
    await expect(verifyActivationKey('ESP-001', 'SENSOR', secretKey)).rejects.toMatchObject({ statusCode: 409 })
    // Sai key thì vẫn chỉ là "mã không đúng" — không lộ thiết bị đã bị thu hồi
    await expect(verifyActivationKey('ESP-001', 'SENSOR', 'AAAA-BBBB-CCCC')).rejects.toMatchObject({ statusCode: 400 })
    expect(await AuditLog.countDocuments({ action: 'DEVICE_PROVISION_REVOKED' })).toBe(1)
  })

  it('refuses a device still running at a farm, and a second revoke', async () => {
    const { adminId, id } = await provision()
    await SensorNode.create({ device_id: 'ESP-001', zone_id: new mongoose.Types.ObjectId(), status: 'ONLINE' })

    await expect(revokeProvisionedDevice(adminId, id, 'x')).rejects.toMatchObject({ statusCode: 409 })

    await SensorNode.updateOne({ device_id: 'ESP-001' }, { decommissioned_at: new Date() })
    await revokeProvisionedDevice(adminId, id, 'Hỏng, đã gỡ')
    await expect(revokeProvisionedDevice(adminId, id, 'lần 2')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('requires a reason at the route', async () => {
    const { adminId, id } = await provision()
    await request(app).put(`/admin/provisioned-devices/${id}/revoke`)
      .set('Authorization', `Bearer ${tokenFor(adminId, 'ADMIN')}`).send({ reason: ' ' }).expect(422)
  })
})

describe('cấp lại secretKey', () => {
  it('replaces the key of an unclaimed device: the new key works, the old one no longer does', async () => {
    const { adminId, id, secretKey: oldKey } = await provision()

    const { secret_key: newKey } = await rotateProvisionedKey(adminId, id)

    expect(newKey).not.toBe(oldKey)
    await expect(verifyActivationKey('ESP-001', 'SENSOR', newKey)).resolves.toBeUndefined()
    await expect(verifyActivationKey('ESP-001', 'SENSOR', oldKey)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('re-issues the key of a released device: the old label no longer registers it (BR-26)', async () => {
    const { adminId, id, secretKey: oldKey } = await provision()
    await ProvisionedDevice.updateOne({ _id: id }, { claimed_at: new Date() })
    await SensorNode.create({ device_id: 'ESP-001', zone_id: new mongoose.Types.ObjectId(), status: 'ONLINE', decommissioned_at: new Date() })

    const { secret_key: newKey } = await rotateProvisionedKey(adminId, id)

    await expect(verifyActivationKey('ESP-001', 'SENSOR', newKey)).resolves.toBeUndefined()
    await expect(verifyActivationKey('ESP-001', 'SENSOR', oldKey)).rejects.toMatchObject({ statusCode: 400 })
    const audit = await AuditLog.findOne({ action: 'DEVICE_PROVISION_KEY_ROTATED' }).lean()
    expect(audit?.metadata).toMatchObject({ deviceId: 'ESP-001', released: true })
  })

  it('refuses a device in service or revoked', async () => {
    const { adminId, id, secretKey } = await provision()
    await ProvisionedDevice.updateOne({ _id: id }, { claimed_at: new Date() })
    await SensorNode.create({ device_id: 'ESP-001', zone_id: new mongoose.Types.ObjectId(), status: 'ONLINE' })
    await request(app).post(`/admin/provisioned-devices/${id}/rotate-key`)
      .set('Authorization', `Bearer ${tokenFor(adminId, 'ADMIN')}`).expect(409)
    await expect(verifyActivationKey('ESP-001', 'SENSOR', secretKey)).resolves.toBeUndefined()   // key cũ vẫn giữ

    const other = await createProvisionedDevice(adminId, { device_id: 'ESP-002', kind: 'SENSOR' })
    const otherId = String((await ProvisionedDevice.findOne({ device_id: other.device_id }))!._id)
    await revokeProvisionedDevice(adminId, otherId, 'Lỗi')
    await expect(rotateProvisionedKey(adminId, otherId)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('GET /admin/provisioned-devices — trạng thái nhãn (Report 3 §6.16)', () => {
  it('derives IN_STOCK, IN_SERVICE, RELEASED and REVOKED for controllers and cameras', async () => {
    const { adminId } = await provision('IN-STOCK')
    const add = (device_id: string, kind: 'SENSOR' | 'CAMERA') => createProvisionedDevice(adminId, { device_id, kind })
    await Promise.all([add('SERVING', 'SENSOR'), add('RELEASED', 'SENSOR'), add('REVOKED', 'SENSOR'), add('CAM-SERVING', 'CAMERA')])
    await ProvisionedDevice.updateMany({ device_id: { $in: ['SERVING', 'RELEASED', 'CAM-SERVING'] } }, { claimed_at: new Date() })
    await SensorNode.create([
      { device_id: 'SERVING', zone_id: new mongoose.Types.ObjectId(), status: 'ONLINE' },
      { device_id: 'RELEASED', zone_id: new mongoose.Types.ObjectId(), status: 'ONLINE', decommissioned_at: new Date() },
    ])
    await CameraNode.create({ device_id: 'CAM-SERVING', house_id: new mongoose.Types.ObjectId(), status: 'ONLINE' })
    await revokeProvisionedDevice(adminId, String((await ProvisionedDevice.findOne({ device_id: 'REVOKED' }))!._id), 'Mất')

    const res = await request(app).get('/admin/provisioned-devices')
      .set('Authorization', `Bearer ${tokenFor(adminId, 'ADMIN')}`).expect(200)

    const status = Object.fromEntries((res.body.data as Array<{ device_id: string; stock_status: string }>).map(d => [d.device_id, d.stock_status]))
    expect(status).toEqual({
      'IN-STOCK': 'IN_STOCK', SERVING: 'IN_SERVICE', RELEASED: 'RELEASED', REVOKED: 'REVOKED', 'CAM-SERVING': 'IN_SERVICE',
    })
  })
})

describe('GET /admin/users — tìm kiếm', () => {
  async function seed() {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    await mkUser('nguyen.van.a@test.vn', 'TECHNICIAN', { full_name: 'Nguyễn Văn A', phone: '0911111111' })
    await mkUser('tran.b@test.vn', 'TECHNICIAN', { full_name: 'Trần B' })
    await mkUser('locked@test.vn', 'FARM_OWNER', { is_active: false })
    await mkUser('deleted-x@swiftletcare.local', 'FARM_OWNER', { is_active: false, deleted_at: new Date() })
    return tokenFor(admin._id, 'ADMIN')
  }
  const emails = (res: request.Response) => (res.body.data as Array<{ email: string }>).map(u => u.email).sort()

  it('finds users by name, email or phone, case-insensitively', async () => {
    const token = await seed()
    const get = (qs: string) => request(app).get(`/admin/users?${qs}`).set('Authorization', `Bearer ${token}`).expect(200)

    expect(emails(await get(`q=${encodeURIComponent('nguyễn')}`))).toEqual(['nguyen.van.a@test.vn'])
    expect(emails(await get('q=TRAN.B'))).toEqual(['tran.b@test.vn'])
    expect(emails(await get('q=0911'))).toEqual(['nguyen.van.a@test.vn'])
    // Ký tự đặc biệt của regex không làm vỡ truy vấn
    expect(emails(await get(`q=${encodeURIComponent('.*')}`))).toEqual([])
  })

  it('separates locked from deleted accounts', async () => {
    const token = await seed()
    const get = (qs: string) => request(app).get(`/admin/users?${qs}`).set('Authorization', `Bearer ${token}`).expect(200)

    expect(emails(await get('status=inactive'))).toEqual(['locked@test.vn'])
    expect(emails(await get('status=deleted'))).toEqual(['deleted-x@swiftletcare.local'])
  })
})
