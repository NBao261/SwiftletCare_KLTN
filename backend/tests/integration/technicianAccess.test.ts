/**
 * FARM-FR-009, Report 3 §2.4 — Technician thấy House, Zone, thiết bị và cảnh báo thiết bị của
 * mọi farm (không cần là thành viên, không còn khu vực phụ trách), không thấy dữ liệu vận hành;
 * mỗi thao tác thiết bị của Technician được audit và báo trong app cho các Farm Owner.
 * Administrator không thấy farm nào. FARM-FR-001, A-5 — tọa độ farm bắt buộc khi tạo.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
import analyticsRoutes from '@/routes/analytics.route'
import deviceRoutes from '@/routes/devices.route'
import farmRoutes from '@/routes/farms.route'
import harvestRoutes from '@/routes/harvests.route'
import healthReportRoutes from '@/routes/healthReports.route'
import telemetryRoutes from '@/routes/telemetry.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true), publishHouseCommand: jest.fn() }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
  emitHouseDeviceStatusChange: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn(),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use('/devices', deviceRoutes)
app.use('/alerts', alertRoutes)
app.use('/telemetry', telemetryRoutes)
app.use('/analytics', analyticsRoutes)
app.use('/harvests', harvestRoutes)
app.use('/health-reports', healthReportRoutes)
app.use(errorHandler)

useTestDb()
afterEach(async () => {
  await Promise.all([Notification.deleteMany({}), CameraNode.deleteMany({})])
})

let seq = 0
async function tokenOf(role: Role) {
  seq++
  const user = await User.create({ email: `${role.toLowerCase()}${seq}@test.vn`, password_hash: 'password123', full_name: role, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}

const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object = {}) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
})

describe('Technician trên mọi farm (FARM-FR-009)', () => {
  it('lists every farm with its houses, zones and devices, without members', async () => {
    const a = await seedOwnerFarm()
    const b = await seedOwnerFarm()
    const tech = as((await tokenOf('TECHNICIAN')).token)

    const farms = (await tech.get('/farms').expect(200)).body.data as Array<{ _id: string; members: unknown[] }>
    expect(farms.map(f => f._id).sort()).toEqual([String(a.farm._id), String(b.farm._id)].sort())
    expect(farms.every(f => f.members.length === 0)).toBe(true)

    const detail = (await tech.get(`/farms/${a.farm._id}`).expect(200)).body.data
    expect(detail.members).toEqual([])
    expect(detail.owner).toBeUndefined()
    const [house] = (await tech.get(`/farms/${a.farm._id}/houses`).expect(200)).body.data
    await tech.get(`/farms/houses/${house._id}/zones`).expect(200)
    await tech.get(`/farms/zones/${a.zone._id}`).expect(200)

    const nodes = (await tech.get('/devices/sensor-nodes').expect(200)).body.data as Array<{ _id: string }>
    expect(nodes.map(n => n._id).sort()).toEqual([String(a.node._id), String(b.node._id)].sort())
    await tech.get(`/devices/sensor-nodes/${b.node._id}`).expect(200)
  })

  it('rejects the dashboard, analytics, telemetry, bird counts, live stream, harvests and health reports with 403', async () => {
    const { farm, zone } = await seedOwnerFarm()
    const house = (await House.findOne({ farm_id: farm._id }))!
    const camera = await CameraNode.create({ device_id: 'CAM-1', house_id: house._id, status: 'ONLINE' })
    const tech = as((await tokenOf('TECHNICIAN')).token)

    for (const path of [
      `/telemetry/zones/${zone._id}/latest`,
      `/telemetry/zones/${zone._id}/history`,
      `/analytics/env/summary?zoneId=${zone._id}`,
      `/analytics/bird-count/daily?houseId=${house._id}`,
      `/devices/camera-nodes/${camera._id}/stream-token`,
      `/harvests?farmId=${farm._id}`,
      `/health-reports?zoneId=${zone._id}`,
    ]) {
      expect([path, (await tech.get(path)).status]).toEqual([path, 403])
    }
  })

  it('sees only device alerts, of every farm', async () => {
    const a = await seedOwnerFarm()
    const b = await seedOwnerFarm()
    const base = { severity: 'HIGH', title: 't', message: 'm', status: 'ACTIVE' }
    const offline = await Alert.create({ ...base, farm_id: a.farm._id, zone_id: a.zone._id, type: 'NODE_OFFLINE' })
    const pumpDry = await Alert.create({ ...base, farm_id: b.farm._id, zone_id: b.zone._id, type: 'PUMP_DRY' })
    const breach = await Alert.create({ ...base, farm_id: a.farm._id, zone_id: a.zone._id, type: 'THRESHOLD_BREACH' })
    const tech = as((await tokenOf('TECHNICIAN')).token)

    const listed = (await tech.get('/alerts').expect(200)).body.data as Array<{ _id: string }>
    expect(listed.map(r => r._id).sort()).toEqual([String(offline._id), String(pumpDry._id)].sort())
    // Bộ lọc type của người gọi vẫn áp, giao với loại thiết bị
    expect((await tech.get('/alerts?type=THRESHOLD_BREACH').expect(200)).body.data).toEqual([])
    await tech.get(`/alerts/${offline._id}`).expect(200)
    await tech.get(`/alerts/${breach._id}`).expect(403)
  })

  it('moving a controller writes one audit entry and one in-app notification per Farm Owner', async () => {
    const { owner, farm, node } = await seedOwnerFarm()
    const coOwner = await User.create({ email: 'co@test.vn', password_hash: 'password123', full_name: 'Co', role: 'FARM_OWNER' })
    const expert = await User.create({ email: 'ex@test.vn', password_hash: 'password123', full_name: 'Ex', role: 'DOMAIN_EXPERT' })
    farm.members.push({ user_id: coOwner._id, role: 'FARM_OWNER' } as never, { user_id: expert._id, role: 'DOMAIN_EXPERT' } as never)
    await farm.save()
    const house = (await House.findOne({ farm_id: farm._id }))!
    const zone2 = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Z2' })
    const { user: techUser, token } = await tokenOf('TECHNICIAN')

    await as(token).put(`/devices/sensor-nodes/${node._id}/reassign-zone`, { newZoneId: String(zone2._id) }).expect(200)

    expect(await AuditLog.countDocuments({ action: 'DEVICE_REASSIGNED', actor_id: techUser._id })).toBe(1)
    const notified = (await Notification.find().lean()).map(n => String(n.user_id)).sort()
    expect(notified).toEqual([String(owner._id), String(coOwner._id)].sort())
  })

  it('a Farm Owner moving their own controller notifies nobody', async () => {
    const { farm, node, token } = await seedOwnerFarm()
    const house = (await House.findOne({ farm_id: farm._id }))!
    const zone2 = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Z2' })

    await as(token).put(`/devices/sensor-nodes/${node._id}/reassign-zone`, { newZoneId: String(zone2._id) }).expect(200)
    expect(await Notification.countDocuments()).toBe(0)
  })

  it('a remote command by a Technician is notified to the Farm Owner', async () => {
    const { owner, node } = await seedOwnerFarm()
    await SensorNode.updateOne({ _id: node._id }, { firmware_version: '1.4.0' })
    const { token } = await tokenOf('TECHNICIAN')

    await as(token).post(`/devices/sensor-nodes/${node._id}/commands`, { command: 'RESTART' }).expect(202)
    expect((await Notification.find().lean()).map(n => String(n.user_id))).toEqual([String(owner._id)])
  })
})

describe('Administrator không thấy farm nào (Report 3 §2.4)', () => {
  it('gets an empty farm list and 403 on any farm', async () => {
    const { farm, zone, node } = await seedOwnerFarm()
    const admin = as((await tokenOf('ADMIN')).token)

    expect((await admin.get('/farms').expect(200)).body.data).toEqual([])
    await admin.get(`/farms/${farm._id}`).expect(403)
    await admin.get(`/farms/${farm._id}/houses`).expect(403)
    await admin.get(`/devices/sensor-nodes/${node._id}`).expect(403)
    expect((await admin.get('/devices/sensor-nodes').expect(200)).body.data).toEqual([])
    expect((await admin.get('/alerts').expect(200)).body.data).toEqual([])
    await admin.get(`/telemetry/zones/${zone._id}/latest`).expect(403)
    await admin.get('/harvests').expect(403)
  })
})

describe('tọa độ farm (FARM-FR-001, A-5)', () => {
  const farm = (coordinates?: object) => ({ name: 'F', address: 'x', ...(coordinates && { coordinates }) })

  it('is required at creation and range-checked at creation and update', async () => {
    const { token } = await tokenOf('FARM_OWNER')
    const owner = as(token)

    await owner.post('/farms', farm()).expect(422)
    await owner.post('/farms', farm({ lat: 10.5 })).expect(422)
    await owner.post('/farms', farm({ lat: 95, lng: 106 })).expect(422)
    await owner.post('/farms', farm({ lat: 'abc', lng: 106 })).expect(422)
    const created = (await owner.post('/farms', farm({ lat: 10.7769, lng: 106.7009, extra: 1 })).expect(201)).body.data
    expect(created.coordinates).toEqual({ lat: 10.7769, lng: 106.7009 })
    expect(created.region).toBeUndefined()

    await owner.put(`/farms/${created._id}`, { coordinates: { lat: 10, lng: -200 } }).expect(422)
    await owner.put(`/farms/${created._id}`, { name: 'Tên mới' }).expect(200) // không gửi tọa độ: không bắt buộc
    await owner.put(`/farms/${created._id}`, { coordinates: { lat: '11.5', lng: 107 } }).expect(200)
    expect((await Farm.findById(created._id))!.coordinates).toEqual({ lat: 11.5, lng: 107 })
  })

  it('lets one Farm Owner create two farms, each with its own coordinates', async () => {
    const { user, token } = await tokenOf('FARM_OWNER')
    await as(token).post('/farms', farm({ lat: 10.1, lng: 106.1 })).expect(201)
    await as(token).post('/farms', farm({ lat: 12.2, lng: 109.2 })).expect(201)

    const saved = await Farm.find({ owner_id: user._id }).sort({ created_at: 1 }).lean()
    expect(saved.map(f => f.coordinates)).toEqual([{ lat: 10.1, lng: 106.1 }, { lat: 12.2, lng: 109.2 }])
  })
})
