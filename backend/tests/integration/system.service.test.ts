/**
 * Module SYSTEM — ngưỡng mặc định (khoảng cảm biến, khởi tạo mặc định) và tổng quan sức khỏe hệ thống.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import systemRoutes from '@/routes/system.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { getSystemStatus } from '@/services/device.service'
import { getDefaultThresholds, getHealthOverview, updateDefaultThresholds } from '@/services/system.service'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/system', systemRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await SystemSetting.init()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await Promise.all([
    AuditLog.deleteMany({}), CameraNode.deleteMany({}), Farm.deleteMany({}), House.deleteMany({}),
    SensorNode.deleteMany({}), SystemSetting.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({}), Zone.deleteMany({}),
  ])
})

const adminToken = async () => {
  const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'Admin', role: 'ADMIN' })
  return { admin, token: jwt.sign({ sub: String(admin._id), role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}

describe('default thresholds', () => {
  it('falls back to the built-in defaults without writing to the DB when never configured', async () => {
    expect(await getDefaultThresholds()).toEqual(DEFAULT_THRESHOLDS)
    expect(await SystemSetting.countDocuments()).toBe(0)
  })

  it('merges a partial update, persists it and audits before/after', async () => {
    const { admin } = await adminToken()

    const after = await updateDefaultThresholds(String(admin._id), { temp_max: 33, co2_max: '1800' })

    expect(after).toMatchObject({ ...DEFAULT_THRESHOLDS, temp_max: 33, co2_max: 1800 })
    expect(await getDefaultThresholds()).toMatchObject({ temp_max: 33, co2_max: 1800 })
    const [log] = await AuditLog.find({ action: 'DEFAULT_THRESHOLDS_UPDATED' }).lean()
    expect(log.metadata).toMatchObject({ before: DEFAULT_THRESHOLDS, after: { temp_max: 33 } })
  })

  it.each([
    [{ humidity_max: 500 }, /humidity_max/],
    [{ co2_max: 99_999 }, /co2_max/],
    [{ temp_min: 40 }, /temp_min phải nhỏ hơn temp_max/], // 40 >= temp_max mặc định 31
  ])('rejects %p and stores nothing', async (input, message) => {
    const { admin } = await adminToken()
    await expect(updateDefaultThresholds(String(admin._id), input)).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(message) })
    expect(await SystemSetting.countDocuments()).toBe(0)
  })

  describe('HTTP', () => {
    it('rejects an out-of-range value at the route (422) before it reaches the service', async () => {
      const { token } = await adminToken()
      await request(app).put('/system/settings/default-thresholds').set('Authorization', `Bearer ${token}`)
        .send({ humidity_max: 500 }).expect(422)
      await request(app).put('/system/settings/default-thresholds').set('Authorization', `Bearer ${token}`)
        .send({ temp_max: 'hot' }).expect(422)
    })

    it('accepts a valid partial update and returns the full set', async () => {
      const { token } = await adminToken()
      const res = await request(app).put('/system/settings/default-thresholds').set('Authorization', `Bearer ${token}`)
        .send({ nh3_max: 30 }).expect(200)
      expect(res.body.data).toMatchObject({ ...DEFAULT_THRESHOLDS, nh3_max: 30 })
    })
  })
})

describe('getHealthOverview', () => {
  async function seedFarm(name: string, deleted = false) {
    const owner = await User.create({ email: `${name}@test.vn`, password_hash: 'password123', full_name: name, role: 'FARM_OWNER' })
    const farm = await Farm.create({ name, address: 'HCMC', owner_id: owner._id, is_deleted: deleted })
    const house = await House.create({ farm_id: farm._id, name: `${name}-house` })
    const zone = await Zone.create({ house_id: house._id, name: `${name}-zone` })
    return { owner, farm, zone }
  }

  it('counts farms, zones and devices only for farms that are not soft-deleted', async () => {
    const live = await seedFarm('live')
    const gone = await seedFarm('gone', true)
    await SensorNode.create({ device_id: 'S-live-1', zone_id: live.zone._id, status: 'ONLINE' })
    await SensorNode.create({ device_id: 'S-live-2', zone_id: live.zone._id, status: 'OFFLINE' })
    await CameraNode.create({ device_id: 'C-live', zone_id: live.zone._id, status: 'ONLINE' })
    await SensorNode.create({ device_id: 'S-gone', zone_id: gone.zone._id, status: 'ONLINE' })

    const overview = await getHealthOverview()

    expect(overview.farms.total).toBe(1)
    expect(overview.zones.total).toBe(1)
    expect(overview.devices).toMatchObject({ total: 3, online: 2, offline: 1 })
  })

  it('counts open tickets per priority (CLOSED excluded) and users per role/activity', async () => {
    const { farm } = await seedFarm('live')
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P1', status: 'NEW' })
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P1', status: 'IN_PROGRESS' })
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'AWAITING_FIELD_CONFIRMATION' })
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P2', status: 'CLOSED' })
    await User.create({ email: 'locked@test.vn', password_hash: 'password123', full_name: 'L', role: 'TECHNICIAN', is_active: false })

    const overview = await getHealthOverview()

    expect(overview.openTickets).toEqual({ total: 3, P1: 2, P2: 0, P3: 1 })
    expect(overview.users.byRole.FARM_OWNER).toEqual({ active: 1, inactive: 0 })
    expect(overview.users.byRole.TECHNICIAN).toEqual({ active: 0, inactive: 1 })
    expect(overview.users).toMatchObject({ total: 2, active: 1, inactive: 1 })
  })

  it('returns zeros on an empty system', async () => {
    const overview = await getHealthOverview()
    expect(overview.farms.total).toBe(0)
    expect(overview.zones.total).toBe(0)
    expect(overview.devices.total).toBe(0)
    expect(overview.openTickets.total).toBe(0)
  })
})

describe('getSystemStatus (OPS-NFR-004)', () => {
  async function seedFarm(name: string, deleted = false) {
    const owner = await User.create({ email: `${name}@test.vn`, password_hash: 'password123', full_name: name, role: 'FARM_OWNER' })
    const farm = await Farm.create({ name, address: 'HCMC', owner_id: owner._id, is_deleted: deleted })
    const house = await House.create({ farm_id: farm._id, name: `${name}-house` })
    const zone = await Zone.create({ house_id: house._id, name: `${name}-zone` })
    return { farm, zone }
  }

  it('leaves out nodes of soft-deleted farms, so it agrees with the health overview shown beside it', async () => {
    const live = await seedFarm('live')
    const gone = await seedFarm('gone', true)
    await SensorNode.create({ device_id: 'S-live', zone_id: live.zone._id, status: 'ONLINE' })
    await CameraNode.create({ device_id: 'C-live', zone_id: live.zone._id, status: 'OFFLINE' })
    await SensorNode.create({ device_id: 'S-gone', zone_id: gone.zone._id, status: 'ONLINE' })
    await CameraNode.create({ device_id: 'C-gone', zone_id: gone.zone._id, status: 'ONLINE' })

    const status = await getSystemStatus()

    expect(status.summary).toMatchObject({ total: 2, online: 1, offline: 1 })
    expect(status.nodes.map(n => n.device_id).sort()).toEqual(['C-live', 'S-live'])
    expect(status.nodes.every(n => n.farm_name === 'live')).toBe(true)
    expect(status.summary).toEqual((await getHealthOverview()).devices)
  })

  it('returns an empty list when every farm is soft-deleted', async () => {
    const gone = await seedFarm('gone', true)
    await SensorNode.create({ device_id: 'S-gone', zone_id: gone.zone._id, status: 'ONLINE' })

    const status = await getSystemStatus()

    expect(status.summary.total).toBe(0)
    expect(status.nodes).toEqual([])
  })
})
