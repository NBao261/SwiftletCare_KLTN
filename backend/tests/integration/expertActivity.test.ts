/**
 * EXPERT-FR-009 — mỗi quyết định của Domain Expert báo trong ứng dụng cho mọi Farm Owner của farm
 * (tên chuyên gia, nơi, cũ → mới) và có trong lịch sử hoạt động `GET /expert-activity`, đọc từ audit
 * log; lịch sử chỉ Farm Owner và Domain Expert của farm đọc được.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import alertRoutes from '@/routes/alerts.route'
import deviceRoutes from '@/routes/devices.route'
import expertActivityRoutes from '@/routes/expertActivity.route'
import farmRoutes from '@/routes/farms.route'
import healthReportRoutes from '@/routes/healthReports.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { requestContext } from '@/middlewares/requestContext.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import { ZoneHealthReport } from '@/models/zoneHealthReport.model'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true), publishHouseCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitHouseDeviceStatusChange: jest.fn(), emitRelayUpdate: jest.fn(),
}))
jest.mock('@/services/telegram.service', () => ({ sendTelegram: jest.fn().mockResolvedValue(undefined) }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use(requestContext)
app.use('/alerts', alertRoutes)
app.use('/devices', deviceRoutes)
app.use('/farms', farmRoutes)
app.use('/health-reports', healthReportRoutes)
app.use('/expert-activity', expertActivityRoutes)
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
  await Promise.all([Alert, AuditLog, CameraNode, Farm, House, Zone, Notification, User, ZoneHealthReport].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const RING = [[0.38, 0.23], [0.53, 0.14], [0.58, 0.28], [0.43, 0.48]]

let seq = 0
async function seed({ withExpert = true } = {}) {
  seq++
  const mk = (prefix: string, role: Role, full_name: string) =>
    User.create({ email: `${prefix}${seq}@test.vn`, password_hash: 'password123', full_name, role })
  const [owner, coOwner, expert, technician, admin] = await Promise.all([
    mk('o', 'FARM_OWNER', 'Chủ'), mk('c', 'FARM_OWNER', 'Đồng sở hữu'), mk('e', 'DOMAIN_EXPERT', 'Chuyên gia Lan'),
    mk('t', 'TECHNICIAN', 'Kỹ thuật'), mk('a', 'ADMIN', 'Quản trị'),
  ])
  const farm = await Farm.create({
    name: 'F', address: 'x', coordinates: { lat: 10, lng: 106 }, owner_id: owner._id,
    members: [
      { user_id: owner._id, is_primary: true }, { user_id: coOwner._id },
      ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : []),
    ],
  })
  const house = await House.create({ farm_id: farm._id, name: 'Nhà A' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Tầng 1' })
  const camera = await CameraNode.create({ device_id: `cam_${seq}`, house_id: house._id, status: 'ONLINE' })
  const alert = await Alert.create({ farm_id: farm._id, zone_id: zone._id, type: 'NOISE_ANOMALY', severity: 'MEDIUM', title: 'Ồn bất thường', message: 'm' })
  const t = {
    owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT'),
    technician: tokenFor(technician._id, 'TECHNICIAN'), admin: tokenFor(admin._id, 'ADMIN'),
  }
  const send = (method: 'get' | 'put', path: string, token: string, body: object = {}) =>
    request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)
  return { owner, coOwner, expert, farm, house, zone, camera, alert, t, send }
}

/** Sáu quyết định của chuyên gia, mỗi loại một lần */
async function expertDecides(s: Awaited<ReturnType<typeof seed>>, token = s.t.expert) {
  await s.send('put', `/farms/zones/${s.zone._id}/thresholds`, token, { humidity_min: 78 }).expect(200)
  await s.send('put', `/farms/zones/${s.zone._id}/fuzzy-tuning`, token, { fuzzy_humidity_band: 10 }).expect(200)
  await s.send('put', `/farms/zones/${s.zone._id}/detection-tuning`, token, { noise_margin_db: 18 }).expect(200)
  await s.send('put', `/farms/houses/${s.house._id}/bird-count-tuning`, token, { return_rate_drop_pct: 25 }).expect(200)
  await s.send('put', `/devices/camera-nodes/${s.camera._id}/counting-ring`, token, { points: RING, into_ring_is_exit: true }).expect(200)
  await s.send('put', `/alerts/${s.alert._id}/verdict`, token, { result: 'REJECTED', note: 'Tiếng mưa' }).expect(200)
}

describe('thông báo quyết định của chuyên gia (EXPERT-FR-009)', () => {
  it('mỗi quyết định → mỗi Farm Owner có 1 thông báo nêu tên chuyên gia, nơi và giá trị cũ → mới', async () => {
    const s = await seed()
    await expertDecides(s)

    for (const ownerId of [s.owner._id, s.coOwner._id]) {
      const notifications = await Notification.find({ user_id: ownerId }).sort({ created_at: 1 }).lean()
      expect(notifications).toHaveLength(6)
      notifications.forEach(n => {
        expect(n.title).toContain('Chuyên gia Lan')
        expect(n.ref?.kind).toBe('expert_decision')
      })
      const threshold = notifications.find(n => n.title.includes('sửa ngưỡng'))!
      expect(threshold.body).toContain('Tầng 1')
      expect(threshold.body).toContain('humidity_min 75 → 78')
      expect(notifications.find(n => n.title.includes('bác bỏ'))!.body).toContain('Tiếng mưa')
    }
    // Thông báo trỏ tới đúng mục trong lịch sử
    const ref = (await Notification.findOne({ user_id: s.owner._id }).lean())!.ref!
    expect(await AuditLog.exists({ _id: ref.id, farm_id: s.farm._id })).toBeTruthy()
    // Chuyên gia không tự báo cho mình
    expect(await Notification.countDocuments({ user_id: s.expert._id })).toBe(0)
  })

  it('Farm Owner làm thay (BR-22) không tạo thông báo; sửa ngưỡng của Farm Owner không vào lịch sử', async () => {
    const s = await seed({ withExpert: false })
    await s.send('put', `/farms/zones/${s.zone._id}/detection-tuning`, s.t.owner, { noise_margin_db: 18 }).expect(200)
    await s.send('put', `/farms/zones/${s.zone._id}/thresholds`, s.t.owner, { humidity_min: 78 }).expect(200)
    expect(await Notification.countDocuments()).toBe(0)

    const res = await s.send('get', `/expert-activity?farmId=${s.farm._id}`, s.t.owner).expect(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({ action: 'DETECTION_TUNING_UPDATED', actor_role: 'FARM_OWNER', actor: { full_name: 'Chủ' } })
  })
})

describe('GET /expert-activity (EXPERT-FR-009)', () => {
  it('liệt kê đủ quyết định, mới nhất trước, có người làm, vai trò, cũ/mới', async () => {
    const s = await seed()
    await expertDecides(s)

    const res = await s.send('get', `/expert-activity?farmId=${s.farm._id}`, s.t.owner).expect(200)
    expect(res.body.meta.total).toBe(6)
    expect(res.body.data[0].action).toBe('ALERT_VERDICT_SET')
    res.body.data.forEach((entry: { actor_role: string; actor: { full_name: string } }) => {
      expect(entry.actor_role).toBe('DOMAIN_EXPERT')
      expect(entry.actor.full_name).toBe('Chuyên gia Lan')
    })
    const threshold = res.body.data.find((e: { action: string }) => e.action === 'THRESHOLD_UPDATED')
    expect(threshold.metadata.before.humidity_min).toBe(75)
    expect(threshold.metadata.after.humidity_min).toBe(78)
    // Chuyên gia cũng đọc được lịch sử của farm mình
    await s.send('get', `/expert-activity?farmId=${s.farm._id}`, s.t.expert).expect(200)
  })

  it('lọc theo loại, zone, nhà và khoảng thời gian', async () => {
    const s = await seed()
    await expertDecides(s)
    const total = async (query: string) =>
      (await s.send('get', `/expert-activity?farmId=${s.farm._id}&${query}`, s.t.owner).expect(200)).body.meta.total

    expect(await total('type=ALERT_VERDICT_SET')).toBe(1)
    expect(await total(`zoneId=${s.zone._id}`)).toBe(4) // ngưỡng, hệ số mờ, tham số phát hiện, kết luận cảnh báo
    expect(await total(`houseId=${s.house._id}`)).toBe(5) // các quyết định theo zone của nhà + mức giảm + vòng đếm
    expect(await total(`from=${new Date(Date.now() + 60_000).toISOString()}`)).toBe(0)
    await s.send('get', `/expert-activity?farmId=${s.farm._id}&type=ACCOUNT_LOCKED`, s.t.owner).expect(422)
  })

  it('kết luận báo cáo sức khoẻ lọc được theo cả zone và nhà', async () => {
    const s = await seed()
    const report = await ZoneHealthReport.create({
      farm_id: s.farm._id, zone_id: s.zone._id, period_start: new Date(Date.now() - 7 * 86_400_000), period_end: new Date(), metrics: { zone: 'Tầng 1' },
    })
    await s.send('put', `/health-reports/${report._id}/conclusion`, s.t.expert, { text: 'Ổn định' }).expect(200)
    for (const query of [`zoneId=${s.zone._id}`, `houseId=${s.house._id}`]) {
      const res = await s.send('get', `/expert-activity?farmId=${s.farm._id}&${query}`, s.t.owner).expect(200)
      expect(res.body.data.map((e: { action: string }) => e.action)).toEqual(['HEALTH_REPORT_CONCLUDED'])
    }
  })

  it('Technician, Administrator và chuyên gia farm khác bị 403', async () => {
    const s = await seed()
    const other = await seed()
    await s.send('get', `/expert-activity?farmId=${s.farm._id}`, s.t.technician).expect(403)
    await s.send('get', `/expert-activity?farmId=${s.farm._id}`, s.t.admin).expect(403)
    await s.send('get', `/expert-activity?farmId=${s.farm._id}`, other.t.expert).expect(403)
  })
})
