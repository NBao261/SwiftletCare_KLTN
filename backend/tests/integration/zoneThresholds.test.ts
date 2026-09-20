/**
 * Chỉnh ngưỡng Zone (Farm Owner/Technician) — cả đường /farms/zones/:id/thresholds và đường
 * qua thiết bị /devices/sensor-nodes/:id/thresholds — dùng chung validate với ngưỡng mặc định hệ thống.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import deviceRoutes from '@/routes/devices.route'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { publishCommand } from '@/mqtt/mqtt.client'
import { updateNodeThresholds } from '@/services/device.service'
import { updateZoneThresholds } from '@/services/farm.service'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'

jest.mock('@/mqtt/mqtt.client', () => ({
  ...jest.requireActual('@/mqtt/mqtt.client'),
  publishCommand: jest.fn(),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use('/devices', deviceRoutes)
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
  jest.clearAllMocks()
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), House.deleteMany({}), SensorNode.deleteMany({}),
    User.deleteMany({}), Zone.deleteMany({}),
  ])
})

async function seed() {
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', owner_id: owner._id })
  const house = await House.create({ farm_id: farm._id, name: 'House' })
  const zone = await Zone.create({ house_id: house._id, name: 'Zone' })
  const node = await SensorNode.create({ device_id: 'ESP32-A', zone_id: zone._id, status: 'ONLINE' })
  const actor = { _id: String(owner._id), role: 'FARM_OWNER' } as never
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  return { owner, zone, node, actor, token }
}

const thresholdsOf = async (zoneId: unknown) => (await Zone.findById(zoneId))!.toObject().thresholds

describe.each([
  ['updateZoneThresholds (zone route)', (ctx: Awaited<ReturnType<typeof seed>>, body: object) => updateZoneThresholds(String(ctx.zone._id), ctx.actor, body)],
  ['updateNodeThresholds (device route)', (ctx: Awaited<ReturnType<typeof seed>>, body: object) => updateNodeThresholds(String(ctx.node._id), ctx.actor, body)],
])('%s', (_name, update) => {
  it('applies a valid partial update as numbers and leaves the rest alone', async () => {
    const ctx = await seed()

    await update(ctx, { temp_max: '33', co2_max: 1800 })

    expect(await thresholdsOf(ctx.zone._id)).toEqual({ ...DEFAULT_THRESHOLDS, temp_max: 33, co2_max: 1800 })
    expect(publishCommand).toHaveBeenCalledTimes(1)
    const [audit] = await AuditLog.find({ action: 'THRESHOLD_UPDATED' }).lean()
    expect(audit.metadata).toMatchObject({ source: 'MANUAL', after: { temp_max: 33, co2_max: 1800 } })
  })

  it('records only the known keys, with source MANUAL, in the threshold history', async () => {
    const ctx = await seed()

    await update(ctx, { temp_max: 33, role: 'ADMIN', $set: { hacked: true } })

    const [entry] = (await Zone.findById(ctx.zone._id))!.threshold_history
    expect(entry.source).toBe('MANUAL')
    expect(entry.new_values).toEqual({ temp_max: 33 })
  })

  it.each([
    ['an inverted range', { temp_min: 50, temp_max: 10 }, /temp_min phải nhỏ hơn temp_max/],
    ['an inverted range sent as strings', { temp_min: '30', temp_max: '4' }, /temp_min phải nhỏ hơn temp_max/],
    ['a value above the sensor range', { co2_max: 999_999 }, /co2_max/],
    ['a null value', { nh3_max: null }, /nh3_max phải là một số hợp lệ/],
    ['a blank value', { light_max: '' }, /light_max phải là một số hợp lệ/],
  ])('rejects %s and changes nothing', async (_label, body, message) => {
    const ctx = await seed()

    await expect(update(ctx, body)).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(message) })

    expect(await thresholdsOf(ctx.zone._id)).toEqual(DEFAULT_THRESHOLDS)
    expect(publishCommand).not.toHaveBeenCalled()
    expect(await AuditLog.countDocuments({ action: 'THRESHOLD_UPDATED' })).toBe(0)
  })
})

describe('HTTP', () => {
  it('PUT /farms/zones/:id/thresholds answers 400 for an out-of-range value', async () => {
    const { zone, token } = await seed()
    await request(app).put(`/farms/zones/${zone._id}/thresholds`).set('Authorization', `Bearer ${token}`)
      .send({ humidity_max: 500 }).expect(400)
  })

  it('PUT /devices/sensor-nodes/:id/thresholds answers 400 for the same body', async () => {
    const { node, token } = await seed()
    await request(app).put(`/devices/sensor-nodes/${node._id}/thresholds`).set('Authorization', `Bearer ${token}`)
      .send({ humidity_max: 500 }).expect(400)
  })

  it('both routes accept a valid update (200)', async () => {
    const { zone, node, token } = await seed()
    await request(app).put(`/farms/zones/${zone._id}/thresholds`).set('Authorization', `Bearer ${token}`)
      .send({ temp_max: 32 }).expect(200)
    await request(app).put(`/devices/sensor-nodes/${node._id}/thresholds`).set('Authorization', `Bearer ${token}`)
      .send({ temp_max: 33 }).expect(200)
    expect((await thresholdsOf(zone._id)).temp_max).toBe(33)
  })
})
