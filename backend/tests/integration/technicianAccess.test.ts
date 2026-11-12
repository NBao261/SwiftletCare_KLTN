/**
 * Report 3 4.x, AUTH-FR-004, 005, 013 — Farm Technician là thợ của chủ farm: được mời vào farm, chỉ thấy
 * và thao tác trên nhà được Farm Owner gán (dashboard, relay, khởi động lại, vòng đếm); nhà khác, farm
 * khác, thu hoạch, báo cáo sức khỏe → 403. FARM-FR-009, 013 — Administrator thấy thiết bị và cảnh báo
 * thiết bị của mọi farm và gửi lệnh từ xa; Farm Owner, Farm Technician chỉ khởi động lại.
 * FARM-FR-001, A-5 — tọa độ farm bắt buộc khi tạo.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import mongoose from 'mongoose'
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
import { Invitation } from '@/models/invitation.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import { acceptInvitation } from '@/services/farm.service'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
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
  await Promise.all([Notification.deleteMany({}), CameraNode.deleteMany({}), Invitation.deleteMany({})])
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
  delete: (path: string) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

/**
 * Farm của chủ với 2 nhà: H (Zone, SensorNode của seedOwnerFarm) và H2 (Zone2, Node2); 1 Farm Technician
 * thành viên farm, chưa được gán nhà nào.
 */
async function seedFarmWithTechnician() {
  const a = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: a.farm._id }))!
  const house2 = await House.create({ farm_id: a.farm._id, name: 'H2' })
  const zone2 = await Zone.create({ house_id: house2._id, name: 'Z2' })
  const node2 = await SensorNode.create({ device_id: `ESP-H2-${++seq}`, zone_id: zone2._id, status: 'ONLINE' })
  const tech = await tokenOf('FARM_TECHNICIAN')
  a.farm.members.push({ user_id: tech.user._id, role: 'FARM_TECHNICIAN' } as never)
  await a.farm.save()
  return { ...a, house, house2, zone2, node2, tech, owner$: as(a.token), tech$: as(tech.token) }
}

const assignPath = (houseId: unknown, userId: unknown) => `/farms/houses/${houseId}/technicians/${userId}`

describe('mời và gán Farm Technician (AUTH-FR-005, 013)', () => {
  it('the Primary Owner invites a Farm Technician who joins the farm with that role', async () => {
    const { farm, owner$ } = await seedOwnerFarm().then(a => ({ ...a, owner$: as(a.token) }))
    const { user } = await tokenOf('FARM_TECHNICIAN')

    const invitation = (await owner$.post(`/farms/${farm._id}/members`, { email: user.email, role: 'FARM_TECHNICIAN' }).expect(201)).body.data
    expect(invitation.invited_role).toBe('FARM_TECHNICIAN')
    await acceptInvitation(invitation.token, { _id: String(user._id), email: user.email, role: 'FARM_TECHNICIAN' })
    const member = (await Farm.findById(farm._id))!.members.find(m => String(m.user_id) === String(user._id))
    expect(member?.role).toBe('FARM_TECHNICIAN')

    // 1 email = 1 role: tài khoản Farm Owner không được mời làm Farm Technician
    const { user: otherOwner } = await tokenOf('FARM_OWNER')
    await owner$.post(`/farms/${farm._id}/members`, { email: otherOwner.email, role: 'FARM_TECHNICIAN' }).expect(409)
  })

  it('assigns only a Farm Technician member, keeps one primary per house and audits each change', async () => {
    const { farm, house, tech, owner$, owner } = await seedFarmWithTechnician()
    const second = await tokenOf('FARM_TECHNICIAN')
    farm.members.push({ user_id: second.user._id, role: 'FARM_TECHNICIAN' } as never)
    await farm.save()
    const outsider = await tokenOf('FARM_TECHNICIAN')

    await owner$.put(assignPath(house._id, outsider.user._id)).expect(409)
    await owner$.put(assignPath(house._id, owner._id)).expect(409)

    await owner$.put(assignPath(house._id, tech.user._id), { primary: true }).expect(200)
    const res = await owner$.put(assignPath(house._id, second.user._id), { primary: true }).expect(200)
    expect(res.body.data.technicians).toEqual([
      { user_id: String(tech.user._id), primary: false },
      { user_id: String(second.user._id), primary: true },
    ])
    // Gán lại chỉ đổi primary, không nhân đôi
    await owner$.put(assignPath(house._id, tech.user._id)).expect(200)
    expect((await House.findById(house._id))!.technicians).toHaveLength(2)
    expect(await AuditLog.countDocuments({ action: 'HOUSE_TECHNICIAN_ASSIGNED', farm_id: farm._id })).toBe(3)

    await owner$.delete(assignPath(house._id, second.user._id)).expect(200)
    await owner$.delete(assignPath(house._id, second.user._id)).expect(200) // không còn lần gán: vẫn 200
    expect(await AuditLog.countDocuments({ action: 'HOUSE_TECHNICIAN_UNASSIGNED' })).toBe(1)
    expect((await House.findById(house._id))!.technicians.map(t => String(t.user_id))).toEqual([String(tech.user._id)])
  })

  it('only a Farm Owner of the farm assigns: technician, expert and other owners get 403', async () => {
    const { house, tech, tech$ } = await seedFarmWithTechnician()
    const other = await seedOwnerFarm()
    const expert = await tokenOf('DOMAIN_EXPERT')

    await tech$.put(assignPath(house._id, tech.user._id)).expect(403)
    await as(expert.token).put(assignPath(house._id, tech.user._id)).expect(403)
    await as(other.token).put(assignPath(house._id, tech.user._id)).expect(403)
  })
})

describe('Farm Technician chỉ trên nhà được giao (AUTH-FR-004, 013)', () => {
  it('sees its farm but no house, zone, device or data before being assigned', async () => {
    const { farm, zone, node, tech$ } = await seedFarmWithTechnician()

    const farms = (await tech$.get('/farms').expect(200)).body.data as Array<{ _id: string; members: unknown[] }>
    expect(farms.map(f => f._id)).toEqual([String(farm._id)])
    expect(farms[0].members).toHaveLength(1) // chỉ bản ghi của chính mình
    const detail = (await tech$.get(`/farms/${farm._id}`).expect(200)).body.data
    expect(detail.owner).toBeUndefined()

    expect((await tech$.get(`/farms/${farm._id}/houses`).expect(200)).body.data).toEqual([])
    await tech$.get(`/farms/zones/${zone._id}`).expect(403)
    expect((await tech$.get('/devices/sensor-nodes').expect(200)).body.data).toEqual([])
    await tech$.get(`/devices/sensor-nodes/${node._id}`).expect(403)
    await tech$.get(`/telemetry/zones/${zone._id}/latest`).expect(403)
  })

  it('reads the dashboard data of the assigned house only', async () => {
    const { farm, house, house2, zone, zone2, node, tech, owner$, tech$ } = await seedFarmWithTechnician()
    await owner$.put(assignPath(house._id, tech.user._id)).expect(200)
    const other = await seedOwnerFarm()

    const houses = (await tech$.get(`/farms/${farm._id}/houses`).expect(200)).body.data as Array<{ _id: string }>
    expect(houses.map(h => h._id)).toEqual([String(house._id)])
    await tech$.get(`/farms/houses/${house._id}/zones`).expect(200)
    await tech$.get(`/farms/houses/${house2._id}/zones`).expect(403)
    await tech$.get(`/farms/zones/${zone._id}`).expect(200)
    const nodes = (await tech$.get('/devices/sensor-nodes').expect(200)).body.data as Array<{ _id: string }>
    expect(nodes.map(n => n._id)).toEqual([String(node._id)])

    for (const path of [
      `/telemetry/zones/${zone._id}/latest`,
      `/telemetry/zones/${zone._id}/history`,
      `/analytics/env/summary?zoneId=${zone._id}`,
      `/analytics/bird-count/daily?houseId=${house._id}`,
      // HARVEST-FR-001 — thợ xem lô của nhà được giao (lọc ở service, harvestConfirm.test.ts)
      `/harvests?farmId=${farm._id}`,
    ]) {
      expect([path, (await tech$.get(path)).status]).toEqual([path, 200])
    }
    for (const path of [
      `/telemetry/zones/${zone2._id}/latest`,
      `/analytics/bird-count/daily?houseId=${house2._id}`,
      `/telemetry/zones/${other.zone._id}/latest`,
      `/farms/${other.farm._id}`,
      `/analytics/control/suggestion?zoneId=${zone._id}`,
      `/health-reports?zoneId=${zone._id}`,
    ]) {
      expect([path, (await tech$.get(path)).status]).toEqual([path, 403])
    }
  })

  it('overrides relays and draws the counting ring in the assigned house only', async () => {
    const { house, house2, node, node2, tech, owner$, tech$ } = await seedFarmWithTechnician()
    await owner$.put(assignPath(house._id, tech.user._id)).expect(200)

    await tech$.post(`/devices/sensor-nodes/${node._id}/relay`, { relayName: 'misting', state: true }).expect(200)
    await tech$.delete(`/devices/sensor-nodes/${node._id}/relay-override`).expect(200)
    await tech$.post(`/devices/sensor-nodes/${node2._id}/relay`, { relayName: 'misting', state: true }).expect(403)

    const ring = { points: [[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]], into_ring_is_exit: true }
    const camera = await CameraNode.create({ device_id: 'CAM-1', house_id: house._id, status: 'ONLINE' })
    const camera2 = await CameraNode.create({ device_id: 'CAM-2', house_id: house2._id, status: 'ONLINE' })
    await tech$.put(`/devices/camera-nodes/${camera._id}/counting-ring`, ring).expect(200)
    await tech$.put(`/devices/camera-nodes/${camera2._id}/counting-ring`, ring).expect(403)
  })

  it('does not set up, move or remove devices, nor manage audio tracks', async () => {
    const { house, zone2, node, tech, owner$, tech$ } = await seedFarmWithTechnician()
    await owner$.put(assignPath(house._id, tech.user._id)).expect(200)

    await tech$.put(`/devices/sensor-nodes/${node._id}/reassign-zone`, { newZoneId: String(zone2._id) }).expect(403)
    await tech$.post(`/devices/sensor-nodes/${node._id}/decommission`, { reason: 'x' }).expect(403)
    await tech$.post('/devices/sensor-nodes/register', { device_id: 'X', zone_id: String(zone2._id), secret_key: 'k' }).expect(403)
    await tech$.delete(`/devices/sensor-nodes/${node._id}/audio-tracks/${node._id}`).expect(403)
  })

  it('loses every house of the farm when removed from the farm', async () => {
    const { farm, house, zone, tech, owner$, tech$ } = await seedFarmWithTechnician()
    await owner$.put(assignPath(house._id, tech.user._id)).expect(200)
    await tech$.get(`/telemetry/zones/${zone._id}/latest`).expect(200)

    await owner$.delete(`/farms/${farm._id}/members/${tech.user._id}`).expect(200)
    expect((await House.findById(house._id))!.technicians).toEqual([])
    await tech$.get(`/telemetry/zones/${zone._id}/latest`).expect(403)
  })

  it('reads the alerts of the assigned house only and is not notified yet (G-21)', async () => {
    const { farm, zone, zone2, house, house2, tech, owner$, tech$ } = await seedFarmWithTechnician()
    const base = { severity: 'HIGH', title: 't', message: 'm', status: 'ACTIVE', farm_id: farm._id }
    const offline = await Alert.create({ ...base, zone_id: zone._id, type: 'NODE_OFFLINE' })
    const lowReturn = await Alert.create({ ...base, severity: 'LOW', house_id: house._id, type: 'LOW_RETURN_RATE' })
    const elsewhere = await Alert.create({ ...base, zone_id: zone2._id, type: 'NODE_OFFLINE' })
    const otherHouse = await Alert.create({ ...base, severity: 'LOW', house_id: house2._id, type: 'LOW_RETURN_RATE' })

    // Chưa được giao nhà: danh sách rỗng, kể cả khi lọc theo farm của mình (không 403)
    expect((await tech$.get(`/alerts?farmId=${farm._id}`).expect(200)).body.data).toEqual([])
    await tech$.get(`/alerts/${offline._id}`).expect(403)

    await owner$.put(assignPath(house._id, tech.user._id)).expect(200)
    const ids = (path: string) => tech$.get(path).expect(200).then(res => (res.body.data as Array<{ _id: string }>).map(a => a._id).sort())
    const mine = [String(offline._id), String(lowReturn._id)].sort()
    expect(await ids('/alerts')).toEqual(mine)
    expect(await ids(`/alerts?farmId=${farm._id}`)).toEqual(mine)
    expect(await ids(`/alerts?farmId=${new mongoose.Types.ObjectId()}`)).toEqual([])
    expect((await tech$.get(`/alerts?farmId=${farm._id}&status=ACTIVE&limit=1`).expect(200)).body.meta.total).toBe(2)
    await tech$.get(`/alerts/${offline._id}`).expect(200)
    await tech$.get(`/alerts/${lowReturn._id}`).expect(200)
    await tech$.get(`/alerts/${elsewhere._id}`).expect(403)
    await tech$.get(`/alerts/${otherHouse._id}`).expect(403)
    // Xác nhận cảnh báo của thợ chưa mở ở backend (ALERT-FR-009 cho thợ đi cùng G-21)
    await tech$.put(`/alerts/${offline._id}/acknowledge`, { note: 'x' }).expect(403)
    // Thợ không nằm trong danh sách nhận cảnh báo của farm (cảnh báo theo nhà là G-21)
    const { findRecipients } = await import('@/services/notification.service')
    expect((await findRecipients(String(farm._id))).map(u => String(u._id))).not.toContain(String(tech.user._id))
  })
})

describe('lệnh từ xa (FARM-FR-013)', () => {
  const send = (token: string, nodeId: unknown, command: string) =>
    as(token).post(`/devices/sensor-nodes/${nodeId}/commands`, { command })

  it('Farm Owner and Farm Technician restart only; a technician restart is notified to the Farm Owner', async () => {
    const { owner, house, node, node2, tech, token } = await seedFarmWithTechnician()
    await SensorNode.updateMany({ _id: { $in: [node._id, node2._id] } }, { firmware_version: '1.4.0' })
    await as(token).put(assignPath(house._id, tech.user._id)).expect(200)

    await send(token, node._id, 'RESTART').expect(202)
    await send(token, node._id, 'PUSH_CONFIG').expect(403)
    expect(await Notification.countDocuments()).toBe(0)

    await send(tech.token, node._id, 'RESTART').expect(202)
    await send(tech.token, node._id, 'PUSH_CONFIG').expect(403)
    await send(tech.token, node2._id, 'RESTART').expect(403)
    expect((await Notification.find().lean()).map(n => String(n.user_id))).toEqual([String(owner._id)])
  })

  it('the Administrator sends any command to any farm and the Farm Owner is told', async () => {
    const { owner, node } = await seedOwnerFarm()
    const admin = await tokenOf('ADMIN')

    await send(admin.token, node._id, 'PUSH_CONFIG').expect(202)
    expect(await AuditLog.countDocuments({ action: 'DEVICE_COMMAND_SENT', actor_id: admin.user._id })).toBe(1)
    const [notice] = await Notification.find().lean()
    expect(String(notice.user_id)).toBe(String(owner._id))
    expect(notice.title).toContain('Quản trị viên')
  })
})

describe('Administrator: thiết bị và cảnh báo thiết bị của mọi farm (FARM-FR-009)', () => {
  it('lists devices of every farm but no farm, data or other alert', async () => {
    const a = await seedOwnerFarm()
    const b = await seedOwnerFarm()
    const base = { severity: 'HIGH', title: 't', message: 'm', status: 'ACTIVE' }
    const offline = await Alert.create({ ...base, farm_id: a.farm._id, zone_id: a.zone._id, type: 'NODE_OFFLINE' })
    const pumpDry = await Alert.create({ ...base, farm_id: b.farm._id, zone_id: b.zone._id, type: 'MISTING_INEFFECTIVE' })
    const breach = await Alert.create({ ...base, farm_id: a.farm._id, zone_id: a.zone._id, type: 'THRESHOLD_BREACH' })
    const admin = as((await tokenOf('ADMIN')).token)

    expect((await admin.get('/farms').expect(200)).body.data).toEqual([])
    await admin.get(`/farms/${a.farm._id}`).expect(403)
    const nodes = (await admin.get('/devices/sensor-nodes').expect(200)).body.data as Array<{ _id: string }>
    expect(nodes.map(n => n._id).sort()).toEqual([String(a.node._id), String(b.node._id)].sort())
    await admin.get(`/devices/sensor-nodes/${b.node._id}`).expect(200)

    const listed = (await admin.get('/alerts').expect(200)).body.data as Array<{ _id: string }>
    expect(listed.map(r => r._id).sort()).toEqual([String(offline._id), String(pumpDry._id)].sort())
    // Bộ lọc type của người gọi vẫn áp, giao với loại thiết bị
    expect((await admin.get('/alerts?type=THRESHOLD_BREACH').expect(200)).body.data).toEqual([])
    await admin.get(`/alerts/${offline._id}`).expect(200)
    await admin.get(`/alerts/${breach._id}`).expect(403)

    await admin.get(`/telemetry/zones/${a.zone._id}/latest`).expect(403)
    await admin.get('/harvests').expect(403)
    await admin.post(`/devices/sensor-nodes/${a.node._id}/relay`, { relayName: 'misting', state: true }).expect(403)
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
