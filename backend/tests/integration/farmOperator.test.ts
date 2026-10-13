/**
 * Farm Operator (AUTH-FR-005, SRS v1.23.0) — nhân viên vận hành do Farm Owner mời,
 * phạm vi cả farm hoặc chỉ một số Zone. Được: giám sát, xác nhận cảnh báo, relay,
 * ngưỡng, ticket, nhập thu hoạch. Không được: sửa/xoá farm, quản lý thành viên,
 * tạo House/Zone, đăng bán trên Chợ yến.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import farmRoutes from '@/routes/farms.route'
import deviceRoutes from '@/routes/devices.route'
import harvestRoutes from '@/routes/harvests.route'
import marketplaceRoutes from '@/routes/marketplace.route'
import ticketRoutes from '@/routes/tickets.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { House, Zone } from '@/models/houseZone.model'
import { Invitation } from '@/models/invitation.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { listAlerts } from '@/services/alert.service'
import { completeDeletionRequest } from '@/services/admin.service'
import { registerUser } from '@/services/auth.service'
import { acceptInvitation, getFarm, inviteMember, listHouses } from '@/services/farm.service'
import { findRecipients } from '@/services/notification.service'
import { listTickets } from '@/services/ticket.service'
import type { CurrentUser, Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
  emitTicketAssigneeChanged: jest.fn(), removeUserFromTicketRoom: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use('/devices', deviceRoutes)
app.use('/harvests', harvestRoutes)
app.use('/marketplace', marketplaceRoutes)
app.use('/tickets', ticketRoutes)
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
    Alert, AuditLog, SensorNode, Farm, HarvestBatch, House, Zone, Invitation, Ticket, User,
  ].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const asUser = (u: { _id: unknown; email: string; role: Role }): CurrentUser => ({ _id: String(u._id), email: u.email, role: u.role })

let seq = 0
const mkUser = (role: Role, email = `u${++seq}@test.vn`) =>
  User.create({ email, password_hash: 'password123', full_name: email, role })

/** Farm có 2 zone; 1 Operator chỉ zone A, 1 Operator cả farm */
async function seed() {
  const owner = await mkUser('FARM_OWNER')
  const scoped = await mkUser('FARM_OPERATOR')
  const whole = await mkUser('FARM_OPERATOR')
  const farm = await Farm.create({ name: 'F', address: 'x', region: 'HCMC', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zoneA = await Zone.create({ house_id: house._id, name: 'A' })
  const zoneB = await Zone.create({ house_id: house._id, name: 'B' })
  farm.members.push(
    { user_id: scoped._id, role: 'FARM_OPERATOR', zone_ids: [zoneA._id] } as never,
    { user_id: whole._id, role: 'FARM_OPERATOR', zone_ids: [] } as never,
  )
  await farm.save()
  const nodeA = await SensorNode.create({ device_id: `a-${seq}`, zone_id: zoneA._id, status: 'ONLINE' })
  const nodeB = await SensorNode.create({ device_id: `b-${seq}`, zone_id: zoneB._id, status: 'ONLINE' })
  return {
    owner, scoped, whole, farm, house, zoneA, zoneB, nodeA, nodeB,
    t: { owner: tokenFor(owner._id, 'FARM_OWNER'), scoped: tokenFor(scoped._id, 'FARM_OPERATOR'), whole: tokenFor(whole._id, 'FARM_OPERATOR') },
  }
}

const call = (method: 'get' | 'post' | 'put' | 'delete', path: string, token: string, body: object = {}) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

describe('mời Farm Operator (AUTH-FR-005/010)', () => {
  it('mời kèm Zone, đăng ký mới tự nhận lời mời và mang role FARM_OPERATOR với đúng phạm vi', async () => {
    const { owner, farm, zoneA } = await seed()
    const inv = await inviteMember(String(farm._id), asUser(owner), { email: 'op@test.vn', role: 'FARM_OPERATOR', zone_ids: [String(zoneA._id)] })
    expect(inv.invited_role).toBe('FARM_OPERATOR')

    const user = await registerUser({ email: 'op@test.vn', password: 'password123', full_name: 'Op' })
    expect(user.role).toBe('FARM_OPERATOR')
    const member = (await Farm.findById(farm._id))!.members.find(m => String(m.user_id) === String(user._id))!
    expect(member.role).toBe('FARM_OPERATOR')
    expect(member.zone_ids.map(String)).toEqual([String(zoneA._id)])
    expect(await AuditLog.countDocuments({ action: 'FARM_MEMBER_INVITED' })).toBe(1)
  })

  it('từ chối zone của farm khác, zone cho đồng sở hữu, và email đã mang role khác', async () => {
    const { owner, farm, scoped } = await seed()
    const other = await seed()
    const me = asUser(owner)
    await expect(inviteMember(String(farm._id), me, { email: 'x@test.vn', role: 'FARM_OPERATOR', zone_ids: [String(other.zoneA._id)] }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(inviteMember(String(farm._id), me, { email: 'y@test.vn', role: 'FARM_OWNER', zone_ids: [String(other.zoneA._id)] }))
      .rejects.toMatchObject({ statusCode: 400 })
    const tech = await mkUser('TECHNICIAN')
    await expect(inviteMember(String(farm._id), me, { email: tech.email, role: 'FARM_OPERATOR' })).rejects.toMatchObject({ statusCode: 409 })
    expect(scoped).toBeDefined()
  })

  it('tài khoản Farm Owner không nhận được lời mời Operator (1 email = 1 role)', async () => {
    const { owner, farm } = await seed()
    const fo = await mkUser('FARM_OWNER', 'fo@test.vn')
    const inv = await Invitation.create({
      farm_id: farm._id, invited_email: 'fo@test.vn', invited_role: 'FARM_OPERATOR', invited_by: owner._id,
      token: 'tok-op', expires_at: new Date(Date.now() + 86_400_000),
    })
    await expect(acceptInvitation(inv.token, asUser(fo))).rejects.toMatchObject({ statusCode: 409 })
  })

  it('Primary Owner đổi phạm vi Operator; không áp cho đồng sở hữu; Operator không tự đổi được', async () => {
    const { farm, owner, scoped, zoneB, t } = await seed()
    await call('put', `/farms/${farm._id}/members/${scoped._id}`, t.scoped, { zone_ids: [String(zoneB._id)] }).expect(403)
    await call('put', `/farms/${farm._id}/members/${scoped._id}`, t.owner, { zone_ids: [String(zoneB._id)] }).expect(200)
    const member = (await Farm.findById(farm._id))!.members.find(m => String(m.user_id) === String(scoped._id))!
    expect(member.zone_ids.map(String)).toEqual([String(zoneB._id)])
    await call('put', `/farms/${farm._id}/members/${owner._id}`, t.owner, { zone_ids: [] }).expect(400)
    expect(await AuditLog.countDocuments({ action: 'FARM_OPERATOR_SCOPE_UPDATED' })).toBe(1)
  })
})

describe('phạm vi Zone', () => {
  it('Operator theo Zone chỉ điều khiển relay/sửa ngưỡng trong Zone của mình; Operator cả farm thì mọi Zone', async () => {
    const { zoneA, zoneB, nodeA, nodeB, t } = await seed()
    const relay = { relayName: 'misting', state: true }
    await call('post', `/devices/sensor-nodes/${nodeA._id}/relay`, t.scoped, relay).expect(200)
    await call('post', `/devices/sensor-nodes/${nodeB._id}/relay`, t.scoped, relay).expect(403)
    await call('put', `/farms/zones/${zoneA._id}/thresholds`, t.scoped, { temp_max: 32 }).expect(200)
    await call('put', `/farms/zones/${zoneB._id}/thresholds`, t.scoped, { temp_max: 32 }).expect(403)
    await call('post', `/devices/sensor-nodes/${nodeB._id}/relay`, t.whole, relay).expect(200)
  })

  it('danh sách cảnh báo/ticket chỉ gồm Zone trong phạm vi + bản ghi cấp farm; House ngoài phạm vi bị ẩn', async () => {
    const { farm, owner, scoped, zoneA, zoneB } = await seed()
    const base = { farm_id: farm._id, type: 'POWER_OUTAGE', severity: 'HIGH', title: 't', message: 'm' }
    await Alert.create([{ ...base, zone_id: zoneA._id }, { ...base, zone_id: zoneB._id }, { ...base }])
    await Ticket.create([
      { farm_id: farm._id, zone_id: zoneA._id, type: 'OTHER', priority: 'P3', created_by: owner._id },
      { farm_id: farm._id, zone_id: zoneB._id, type: 'OTHER', priority: 'P3', created_by: owner._id },
    ])

    expect((await listAlerts(asUser(scoped), {})).total).toBe(2)
    expect((await listAlerts(asUser(owner), {})).total).toBe(3)
    expect((await listTickets(asUser(scoped), {})).total).toBe(1)
    const otherHouse = await House.create({ farm_id: farm._id, name: 'H2' })
    await Zone.create({ house_id: otherHouse._id, name: 'C' })
    expect((await listHouses(String(farm._id), asUser(scoped))).map(h => h.name)).toEqual(['H'])
  })

  it('thông báo cảnh báo: Operator theo Zone chỉ nhận cảnh báo Zone của mình và cảnh báo cấp farm', async () => {
    const { farm, owner, scoped, whole, zoneA, zoneB } = await seed()
    const ids = async (zone?: unknown) => (await findRecipients(String(farm._id), zone)).map(u => String(u._id))
    expect(await ids(zoneB._id)).toEqual(expect.arrayContaining([String(owner._id), String(whole._id)]))
    expect(await ids(zoneB._id)).not.toContain(String(scoped._id))
    expect(await ids(zoneA._id)).toContain(String(scoped._id))
    expect(await ids()).toContain(String(scoped._id))
  })
})

describe('việc Operator không được làm', () => {
  it('sửa/xoá farm, mời thành viên, tạo House, đăng bán → 403; không thấy email thành viên', async () => {
    const { farm, scoped, t } = await seed()
    await call('put', `/farms/${farm._id}`, t.scoped, { name: 'x' }).expect(403)
    await call('delete', `/farms/${farm._id}`, t.scoped).expect(403)
    await call('post', `/farms/${farm._id}/members`, t.scoped, { email: 'z@test.vn' }).expect(403)
    await call('post', `/farms/${farm._id}/houses`, t.scoped, { name: 'H9' }).expect(403)
    await call('post', '/marketplace/listings', t.scoped, { harvest_batch_id: String(farm._id), title: 'x' }).expect(403)
    const detail = await getFarm(String(farm._id), asUser(scoped))
    expect(detail.members.map(m => String(m.user_id))).toEqual([String(scoped._id)])
  })

  it('nhập mẻ thu hoạch trong Zone của mình được, Zone khác thì không', async () => {
    const { zoneA, zoneB, t } = await seed()
    const body = { harvest_date: new Date().toISOString(), nest_count: 10, weight_grams: 100, nest_type: 'RAW' }
    await call('post', '/harvests', t.scoped, { ...body, zone_id: String(zoneA._id) }).expect(201)
    await call('post', '/harvests', t.scoped, { ...body, zone_id: String(zoneB._id) }).expect(403)
  })
})

describe('ticket của Operator', () => {
  it('Operator theo Zone phải chọn Zone trong phạm vi; chỉ huỷ ticket mình tạo', async () => {
    const { farm, owner, zoneA, zoneB, t } = await seed()
    await call('post', '/tickets', t.scoped, { farm_id: String(farm._id), type: 'OTHER' }).expect(400)
    await call('post', '/tickets', t.scoped, { farm_id: String(farm._id), zone_id: String(zoneB._id), type: 'OTHER' }).expect(403)
    const mine = await call('post', '/tickets', t.scoped, { farm_id: String(farm._id), zone_id: String(zoneA._id), type: 'SENSOR_FAULT' }).expect(201)

    const ownerTicket = await Ticket.create({ farm_id: farm._id, zone_id: zoneA._id, type: 'OTHER', priority: 'P3', created_by: owner._id })
    await call('put', `/tickets/${ownerTicket._id}/cancel`, t.scoped, { reason: 'x' }).expect(403)
    await call('put', `/tickets/${mine.body.data._id}/cancel`, t.scoped, { reason: 'Đã tự xử lý' }).expect(200)
  })

  it('đọc chat ticket trong phạm vi Zone; ticket Zone khác thì 403', async () => {
    const { farm, owner, zoneA, zoneB, t } = await seed()
    const inScope = await Ticket.create({ farm_id: farm._id, zone_id: zoneA._id, type: 'OTHER', priority: 'P3', created_by: owner._id })
    const outScope = await Ticket.create({ farm_id: farm._id, zone_id: zoneB._id, type: 'OTHER', priority: 'P3', created_by: owner._id })
    await call('get', `/tickets/${inScope._id}/messages`, t.scoped).expect(200)
    await call('get', `/tickets/${outScope._id}/messages`, t.scoped).expect(403)
  })
})

describe('xoá tài khoản chủ farm (AUTH-FR-012)', () => {
  it('không chuyển quyền chủ cho Farm Operator — farm không còn đồng sở hữu thì bị xoá mềm', async () => {
    const { farm, owner } = await seed()
    const admin = await mkUser('ADMIN')
    await User.updateOne({ _id: owner._id }, { deletion_requested_at: new Date() })

    await completeDeletionRequest(String(admin._id), String(owner._id), { force: true })

    // Đọc thẳng collection: hook find của Farm tự loại bản ghi đã xoá mềm
    const after = await Farm.collection.findOne({ _id: farm._id })
    expect(after?.is_deleted).toBe(true)
    expect(String(after?.owner_id)).toBe(String(owner._id))
  })
})
