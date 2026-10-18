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
import { SensorNode } from '@/models/device.model'
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
  await Promise.all([AuditLog.deleteMany({}), ProvisionedDevice.deleteMany({}), SensorNode.deleteMany({}), User.deleteMany({})])
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

  it('refuses a device that was already activated or revoked', async () => {
    const { adminId, id } = await provision()
    await ProvisionedDevice.updateOne({ _id: id }, { claimed_at: new Date() })
    await expect(rotateProvisionedKey(adminId, id)).rejects.toMatchObject({ statusCode: 409 })

    const other = await createProvisionedDevice(adminId, { device_id: 'ESP-002', kind: 'SENSOR' })
    const otherId = String((await ProvisionedDevice.findOne({ device_id: other.device_id }))!._id)
    await revokeProvisionedDevice(adminId, otherId, 'Lỗi')
    await expect(rotateProvisionedKey(adminId, otherId)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('GET /admin/users — tìm kiếm', () => {
  async function seed() {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    await mkUser('nguyen.van.a@test.vn', 'TECHNICIAN', { full_name: 'Nguyễn Văn A', phone: '0911111111', assigned_regions: ['HCMC'] })
    await mkUser('tran.b@test.vn', 'TECHNICIAN', { full_name: 'Trần B', assigned_regions: ['TAY_NINH'] })
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

  it('filters technicians by region and separates locked from deleted accounts', async () => {
    const token = await seed()
    const get = (qs: string) => request(app).get(`/admin/users?${qs}`).set('Authorization', `Bearer ${token}`).expect(200)

    // Lọc bằng mã hay bằng tên/tên tỉnh cũ đều ra cùng kết quả
    expect(emails(await get('region=TAY_NINH'))).toEqual(['tran.b@test.vn'])
    expect(emails(await get('region=Long%20An'))).toEqual(['tran.b@test.vn'])
    expect(emails(await get('status=inactive'))).toEqual(['locked@test.vn'])
    expect(emails(await get('status=deleted'))).toEqual(['deleted-x@swiftletcare.local'])
  })
})
