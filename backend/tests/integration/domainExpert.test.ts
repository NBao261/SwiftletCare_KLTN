/**
 * Domain Expert (AUTH-FR-004/005, SRS v2.0.0 mục 4.4) — chuyên gia nuôi yến do Primary
 * Owner mời, phạm vi luôn là cả farm. Được: đọc dữ liệu vận hành, sửa ngưỡng và hệ số
 * mờ. Không được: relay/loa, ghi thu hoạch, xác nhận cảnh báo, sửa/xoá farm,
 * quản lý thành viên, tạo House/Zone.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import alertRoutes from '@/routes/alerts.route'
import farmRoutes from '@/routes/farms.route'
import deviceRoutes from '@/routes/devices.route'
import harvestRoutes from '@/routes/harvests.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { House, Zone } from '@/models/houseZone.model'
import { Invitation } from '@/models/invitation.model'
import { User } from '@/models/user.model'
import { listAlerts } from '@/services/alert.service'
import { completeDeletionRequest } from '@/services/admin.service'
import { acceptInvitation, createAccountFromInvitation, getFarm, inviteMember, listHouses } from '@/services/farm.service'
import { findRecipients } from '@/services/notification.service'
import type { CurrentUser, Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
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
app.use('/alerts', alertRoutes)
app.use('/farms', farmRoutes)
app.use('/devices', deviceRoutes)
app.use('/harvests', harvestRoutes)
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
    Alert, AuditLog, SensorNode, Farm, HarvestBatch, House, Zone, Invitation, User,
  ].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const asUser = (u: { _id: unknown; email: string; role: Role }): CurrentUser => ({ _id: String(u._id), email: u.email, role: u.role })

let seq = 0
const mkUser = (role: Role, email = `u${++seq}@test.vn`) =>
  User.create({ email, password_hash: 'password123', full_name: email, role })

/** Farm có 2 zone, 1 chủ và 1 Domain Expert đã là thành viên */
async function seed() {
  const owner = await mkUser('FARM_OWNER')
  const expert = await mkUser('DOMAIN_EXPERT')
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zoneA = await Zone.create({ house_id: house._id, name: 'A' })
  const zoneB = await Zone.create({ house_id: house._id, name: 'B' })
  farm.members.push({ user_id: expert._id, role: 'DOMAIN_EXPERT' } as never)
  await farm.save()
  const nodeA = await SensorNode.create({ device_id: `a-${seq}`, zone_id: zoneA._id, status: 'ONLINE' })
  return {
    owner, expert, farm, house, zoneA, zoneB, nodeA,
    t: { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') },
  }
}

const call = (method: 'get' | 'post' | 'put' | 'delete', path: string, token: string, body: object = {}) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

describe('mời Domain Expert (AUTH-FR-005/010, EXPERT-FR-001)', () => {
  it('tạo tài khoản từ link lời mời: mang role DOMAIN_EXPERT và thành thành viên cả farm', async () => {
    const { owner, farm } = await seed()
    const inv = await inviteMember(String(farm._id), asUser(owner), { email: 'ex@test.vn', role: 'DOMAIN_EXPERT' })
    expect(inv.invited_role).toBe('DOMAIN_EXPERT')

    const user = await createAccountFromInvitation(inv.token, { full_name: 'Ex', password: 'password123' })
    expect(user.role).toBe('DOMAIN_EXPERT')
    const member = (await Farm.findById(farm._id))!.members.find(m => String(m.user_id) === String(user._id))!
    expect(member.role).toBe('DOMAIN_EXPERT')
    expect(await AuditLog.countDocuments({ action: 'FARM_MEMBER_INVITED' })).toBe(1)
  })

  it('route mời chỉ nhận role FARM_OWNER/DOMAIN_EXPERT; email đã mang role khác bị từ chối', async () => {
    const { owner, farm, t } = await seed()
    await call('post', `/farms/${farm._id}/members`, t.owner, { email: 'a@test.vn', role: 'FARM_OPERATOR' }).expect(422)
    await call('post', `/farms/${farm._id}/members`, t.owner, { email: 'b@test.vn', role: 'DOMAIN_EXPERT' }).expect(201)
    const tech = await mkUser('TECHNICIAN')
    await expect(inviteMember(String(farm._id), asUser(owner), { email: tech.email, role: 'DOMAIN_EXPERT' })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('tài khoản Farm Owner không nhận được lời mời Domain Expert (1 email = 1 role)', async () => {
    const { owner, farm } = await seed()
    const fo = await mkUser('FARM_OWNER', 'fo@test.vn')
    const inv = await Invitation.create({
      farm_id: farm._id, invited_email: 'fo@test.vn', invited_role: 'DOMAIN_EXPERT', invited_by: owner._id,
      token: 'tok-ex', expires_at: new Date(Date.now() + 86_400_000),
    })
    await expect(acceptInvitation(inv.token, asUser(fo))).rejects.toMatchObject({ statusCode: 409 })
  })

  it('không còn route đổi phạm vi Zone của thành viên', async () => {
    const { farm, expert, t } = await seed()
    await call('put', `/farms/${farm._id}/members/${expert._id}`, t.owner, { zone_ids: [] }).expect(404)
  })
})

describe('Domain Expert đọc cả farm và tinh chỉnh thông số', () => {
  it('thấy mọi Zone, House và cảnh báo của farm được mời — không thấy farm khác', async () => {
    const { farm, expert, zoneA, zoneB, t } = await seed()
    const other = await seed()
    const base = { farm_id: farm._id, type: 'UNEXPECTED_RESTART', severity: 'HIGH', title: 't', message: 'm' }
    await Alert.create([{ ...base, zone_id: zoneA._id }, { ...base, zone_id: zoneB._id }, { ...base }])
    await Alert.create({ ...base, farm_id: other.farm._id })

    expect((await listAlerts(asUser(expert), {})).total).toBe(3)
    expect((await listHouses(String(farm._id), asUser(expert))).map(h => h.name)).toEqual(['H'])
    await call('get', `/farms/zones/${zoneB._id}`, t.expert).expect(200)
    await call('get', `/farms/zones/${other.zoneA._id}`, t.expert).expect(403)
  })

  it('sửa ngưỡng và hệ số mờ ở Zone bất kỳ của farm; lịch sử lưu role người sửa', async () => {
    const { zoneA, zoneB, nodeA, t } = await seed()
    await call('put', `/farms/zones/${zoneA._id}/thresholds`, t.expert, { temp_max: 32 }).expect(200)
    await call('put', `/farms/zones/${zoneB._id}/thresholds/reset`, t.expert).expect(200)
    await call('put', `/farms/zones/${zoneB._id}/fuzzy-tuning`, t.expert, { fuzzy_window_sec: 180 }).expect(200)
    await call('put', `/devices/sensor-nodes/${nodeA._id}/thresholds`, t.expert, { humidity_min: 70 }).expect(200)

    const a = (await Zone.findById(zoneA._id))!
    expect(a.threshold_history.map(h => h.changed_by_role)).toEqual(['DOMAIN_EXPERT', 'DOMAIN_EXPERT'])
    const b = (await Zone.findById(zoneB._id))!
    expect(b.fuzzy_tuning_history[0].changed_by_role).toBe('DOMAIN_EXPERT')
  })

  it('xem được mẻ thu hoạch nhưng không ghi', async () => {
    const { farm, owner, zoneA, t } = await seed()
    const body = { zone_id: String(zoneA._id), harvest_date: new Date().toISOString(), nest_count: 10, weight_grams: 100, nest_type: 'RAW' }
    await call('post', '/harvests', t.expert, body).expect(403)
    const created = await call('post', '/harvests', t.owner, body).expect(201)
    const id = created.body.data._id as string

    const list = await call('get', `/harvests?farmId=${farm._id}`, t.expert).expect(200)
    expect(list.body.data).toHaveLength(1)
    await call('get', `/harvests/${id}`, t.expert).expect(200)
    await call('put', `/harvests/${id}`, t.expert, { nest_count: 1 }).expect(403)
    await call('delete', `/harvests/${id}`, t.expert).expect(403)
    expect(owner).toBeDefined()
  })
})

describe('việc Domain Expert không được làm (mục 4.4)', () => {
  it('không điều khiển relay, loa hay lịch loa', async () => {
    const { nodeA, t } = await seed()
    await call('post', `/devices/sensor-nodes/${nodeA._id}/relay`, t.expert, { relayName: 'misting', state: true }).expect(403)
    await call('delete', `/devices/sensor-nodes/${nodeA._id}/relay-override`, t.expert).expect(403)
    await call('put', `/devices/sensor-nodes/${nodeA._id}/speaker-schedule`, t.expert, {}).expect(403)
    await call('post', `/devices/sensor-nodes/${nodeA._id}/audio/stop`, t.expert).expect(403)
    // Chủ farm vẫn điều khiển được
    await call('post', `/devices/sensor-nodes/${nodeA._id}/relay`, t.owner, { relayName: 'misting', state: true }).expect(200)
  })

  it('không xác nhận (acknowledge) cảnh báo — đó là việc của Farm Owner', async () => {
    const { farm, zoneA, t } = await seed()
    const alert = await Alert.create({ farm_id: farm._id, zone_id: zoneA._id, type: 'MISTING_INEFFECTIVE', severity: 'MEDIUM', title: 't', message: 'm' })
    await call('get', `/alerts/${alert._id}`, t.expert).expect(200)
    await call('put', `/alerts/${alert._id}/acknowledge`, t.expert, { note: 'x' }).expect(403)
    await call('put', `/alerts/${alert._id}/acknowledge`, t.owner, { note: 'đã châm nước' }).expect(200)
  })

  it('không sửa/xoá farm, mời thành viên, tạo House; không thấy email thành viên khác', async () => {
    const { farm, expert, t } = await seed()
    await call('put', `/farms/${farm._id}`, t.expert, { name: 'x' }).expect(403)
    await call('delete', `/farms/${farm._id}`, t.expert).expect(403)
    await call('post', `/farms/${farm._id}/members`, t.expert, { email: 'z@test.vn' }).expect(403)
    await call('post', `/farms/${farm._id}/houses`, t.expert, { name: 'H9' }).expect(403)
    const detail = await getFarm(String(farm._id), asUser(expert))
    expect(detail.members.map(m => String(m.user_id))).toEqual([String(expert._id)])
  })

  it('không nhận cảnh báo vận hành ngoài ứng dụng (EXPERT-FR-007)', async () => {
    const { farm, owner, expert } = await seed()
    const ids = (await findRecipients(String(farm._id))).map(u => String(u._id))
    expect(ids).toContain(String(owner._id))
    expect(ids).not.toContain(String(expert._id))
  })
})

describe('xoá tài khoản chủ farm (AUTH-FR-012)', () => {
  it('không chuyển quyền chủ cho Domain Expert — farm không còn đồng sở hữu thì bị xoá mềm', async () => {
    const { farm, owner } = await seed()
    const admin = await mkUser('ADMIN')
    await User.updateOne({ _id: owner._id }, { deletion_requested_at: new Date() })

    await completeDeletionRequest(String(admin._id), String(owner._id))

    // Đọc thẳng collection: hook find của Farm tự loại bản ghi đã xoá mềm
    const after = await Farm.collection.findOne({ _id: farm._id })
    expect(after?.is_deleted).toBe(true)
    expect(String(after?.owner_id)).toBe(String(owner._id))
  })
})
