/**
 * AUTH-FR-007 — audit log: IP theo request, PASSWORD_RESET, DELETION_REQUESTED, DEVICE_REGISTERED.
 */
import crypto from 'crypto'
import express from 'express'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { requestContext } from '@/middlewares/requestContext.middleware'
import { logAction } from '@/services/auditLog.service'
import { requestAccountDeletion, resetPassword } from '@/services/auth.service'
import { registerCameraNode, registerSensorNode } from '@/services/device.service'
import { notifyAdmins } from '@/services/notification.service'
import { getRequestIp } from '@/utils/requestContext.util'

jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

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
  jest.clearAllMocks()
  await Promise.all([
    AuditLog.deleteMany({}), User.deleteMany({}), Farm.deleteMany({}), House.deleteMany({}), Zone.deleteMany({}),
    SensorNode.deleteMany({}), CameraNode.deleteMany({}),
  ])
})

// Cùng thứ tự middleware như app.config.ts (body parser rồi tới requestContext)
const app = express()
app.use(express.json())
app.use(requestContext)
app.post('/echo-ip', (_req, res) => { res.json({ ip: getRequestIp() ?? null }) })
app.post('/log', async (_req, res) => {
  await logAction(undefined, 'CONTEXT_TEST', 'user')
  res.sendStatus(204)
})

describe('request IP capture', () => {
  it('exposes the client IP to code running inside the request, after body parsing', async () => {
    const res = await request(app).post('/echo-ip').send({ any: 'body' }).expect(200)
    expect(res.body.ip).toBeTruthy()
    expect(res.body.ip).not.toMatch(/^::ffff:/)
  })

  it('stores ip_address on audit logs written during a request', async () => {
    await request(app).post('/log').send({ any: 'body' }).expect(204)
    const log = await AuditLog.findOne({ action: 'CONTEXT_TEST' })
    expect(log?.ip_address).toBeTruthy()
  })

  it('leaves ip_address empty for actions written outside a request (jobs, MQTT handlers)', async () => {
    await logAction(undefined, 'BACKGROUND', 'user')
    const log = await AuditLog.findOne({ action: 'BACKGROUND' })
    expect(log).not.toBeNull()
    expect(log?.ip_address).toBeUndefined()
  })
})

describe('PASSWORD_RESET audit', () => {
  const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

  it('logs a successful reset with the user as actor', async () => {
    const user = await User.create({
      email: 'reset@test.vn', password_hash: 'oldpassword1', full_name: 'Reset', role: 'FARM_OWNER',
      password_reset_token_hash: sha256('123456'), password_reset_expires_at: new Date(Date.now() + 600_000),
    })

    await resetPassword('reset@test.vn', '123456', 'newpassword1')

    const log = await AuditLog.findOne({ action: 'PASSWORD_RESET' })
    expect(String(log?.actor_id)).toBe(String(user._id))
    expect(log?.target_type).toBe('user')
  })

  it('does not log when the reset token is wrong', async () => {
    await User.create({
      email: 'reset@test.vn', password_hash: 'oldpassword1', full_name: 'Reset', role: 'FARM_OWNER',
      password_reset_token_hash: sha256('123456'), password_reset_expires_at: new Date(Date.now() + 600_000),
    })

    await expect(resetPassword('reset@test.vn', '000000', 'newpassword1')).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' })
    expect(await AuditLog.countDocuments({ action: 'PASSWORD_RESET' })).toBe(0)
  })
})

describe('DELETION_REQUESTED audit + admin notification', () => {
  it('logs the request and notifies admins once', async () => {
    const user = await User.create({ email: 'leaver@test.vn', password_hash: 'password123', full_name: 'Leaver', role: 'FARM_OWNER' })

    await requestAccountDeletion(String(user._id))

    const log = await AuditLog.findOne({ action: 'DELETION_REQUESTED' })
    expect(String(log?.target_id)).toBe(String(user._id))
    expect(notifyAdmins).toHaveBeenCalledTimes(1)
  })

  it('does not log or notify again for a duplicate request (409)', async () => {
    const user = await User.create({ email: 'leaver@test.vn', password_hash: 'password123', full_name: 'Leaver', role: 'FARM_OWNER' })
    await requestAccountDeletion(String(user._id))

    await expect(requestAccountDeletion(String(user._id))).rejects.toMatchObject({ statusCode: 409 })
    expect(await AuditLog.countDocuments({ action: 'DELETION_REQUESTED' })).toBe(1)
    expect(notifyAdmins).toHaveBeenCalledTimes(1)
  })
})

describe('DEVICE_REGISTERED audit', () => {
  async function seedZone() {
    const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'Admin', role: 'ADMIN' })
    const farm = await Farm.create({ name: 'Farm', address: 'HCMC', owner_id: admin._id })
    const house = await House.create({ farm_id: farm._id, name: 'House' })
    const zone = await Zone.create({ house_id: house._id, name: 'Zone' })
    return { actor: { _id: String(admin._id), role: 'ADMIN' } as never, zoneId: String(zone._id) }
  }

  it('logs sensor node registration', async () => {
    const { actor, zoneId } = await seedZone()
    const node = await registerSensorNode(actor, { device_id: 'ESP32-A', zone_id: zoneId })

    const log = await AuditLog.findOne({ action: 'DEVICE_REGISTERED' })
    expect(log?.target_type).toBe('sensor_node')
    expect(String(log?.target_id)).toBe(String(node._id))
    expect(log?.metadata).toMatchObject({ deviceId: 'ESP32-A', zoneId })
  })

  it('logs camera node registration', async () => {
    const { actor, zoneId } = await seedZone()
    await registerCameraNode(actor, { device_id: 'RPI-1', zone_id: zoneId })

    const log = await AuditLog.findOne({ action: 'DEVICE_REGISTERED' })
    expect(log?.target_type).toBe('camera_node')
  })

  it('does not log a rejected duplicate registration', async () => {
    const { actor, zoneId } = await seedZone()
    await registerSensorNode(actor, { device_id: 'ESP32-A', zone_id: zoneId })

    await expect(registerSensorNode(actor, { device_id: 'ESP32-A', zone_id: zoneId })).rejects.toMatchObject({ statusCode: 409 })
    expect(await AuditLog.countDocuments({ action: 'DEVICE_REGISTERED' })).toBe(1)
  })
})
