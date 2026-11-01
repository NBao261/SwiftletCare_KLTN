/**
 * BR-22 — farm chưa có Domain Expert thì Farm Owner làm thay quyết định của chuyên gia: kết luận cảnh
 * báo suy luận (EXPERT-FR-003), tham số phát hiện và mức giảm tỷ lệ chim về (EXPERT-FR-008), vòng đếm
 * (VISION-FR-018), thông báo chờ kiểm chứng (EXPERT-FR-007). Farm đã có chuyên gia còn hoạt động → Farm
 * Owner 403; chuyên gia bị khoá không tính.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import alertRoutes from '@/routes/alerts.route'
import deviceRoutes from '@/routes/devices.route'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { requestContext } from '@/middlewares/requestContext.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import { createAlert } from '@/services/alert.service'
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
  await Promise.all([Alert, AuditLog, CameraNode, SensorNode, Farm, House, Zone, Notification, User]
    .map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const RING = [[0.38, 0.23], [0.53, 0.14], [0.58, 0.28], [0.43, 0.48]]

let seq = 0
async function seed({ withExpert }: { withExpert: boolean }) {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'Chủ', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'Chuyên gia', role: 'DOMAIN_EXPERT' })
  const farm = await Farm.create({
    name: 'F', address: 'x', coordinates: { lat: 10, lng: 106 }, owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : [])],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Z' })
  const camera = await CameraNode.create({ device_id: `cam_${seq}`, house_id: house._id, status: 'ONLINE' })
  const alert = await Alert.create({ farm_id: farm._id, zone_id: zone._id, type: 'NOISE_ANOMALY', severity: 'MEDIUM', title: 'Ồn bất thường', message: 'm' })
  const owner_t = tokenFor(owner._id, 'FARM_OWNER')
  const put = (path: string, body: object, token = owner_t) =>
    request(app).put(path).set('Authorization', `Bearer ${token}`).send(body)
  const decisions = {
    verdict: () => put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED', note: 'Tiếng mưa' }),
    detection: () => put(`/farms/zones/${zone._id}/detection-tuning`, { noise_margin_db: 18 }),
    birdCount: () => put(`/farms/houses/${house._id}/bird-count-tuning`, { return_rate_drop_pct: 25 }),
    ring: () => put(`/devices/camera-nodes/${camera._id}/counting-ring`, { points: RING, into_ring_is_exit: true }),
  }
  return { owner, expert, farm, house, zone, camera, alert, decisions }
}

/** Thông báo trong ứng dụng gửi không chờ (createAlert không await) — đợi tối đa 1 giây */
async function waitForNotification(userId: unknown) {
  for (let i = 0; i < 20; i++) {
    const found = await Notification.findOne({ user_id: userId }).lean()
    if (found) return found
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return null
}

describe('BR-22 — Farm Owner làm thay chuyên gia', () => {
  it('farm đã có Domain Expert: Farm Owner bị 403 ở cả 4 quyết định, không gì bị ghi', async () => {
    const { alert, zone, decisions } = await seed({ withExpert: true })
    for (const decide of Object.values(decisions)) await decide().expect(403)
    expect((await Alert.findById(alert._id).lean())!.expert_verdict).toBeUndefined()
    expect((await Zone.findById(zone._id).lean())!.detection_tuning_history).toHaveLength(0)
  })

  it('farm chưa có chuyên gia: Farm Owner làm được cả 4, mỗi quyết định ghi vai trò FARM_OWNER', async () => {
    const { alert, zone, house, camera, decisions } = await seed({ withExpert: false })
    for (const decide of Object.values(decisions)) await decide().expect(200)

    expect((await Alert.findById(alert._id).lean())!).toMatchObject({ status: 'DISMISSED', expert_verdict: { role: 'FARM_OWNER' } })
    expect((await Zone.findById(zone._id).lean())!.detection_tuning_history.at(-1)!.changed_by_role).toBe('FARM_OWNER')
    expect((await House.findById(house._id).lean())!.bird_count_tuning_history.at(-1)!.changed_by_role).toBe('FARM_OWNER')
    expect((await CameraNode.findById(camera._id).lean())!.counting_ring_history.at(-1)!.changed_by_role).toBe('FARM_OWNER')
    expect(await AuditLog.countDocuments({ actor_role: 'FARM_OWNER' })).toBe(4)
  })

  it('Domain Expert vẫn làm được khi farm có chuyên gia', async () => {
    const { expert, alert } = await seed({ withExpert: true })
    await request(app).put(`/alerts/${alert._id}/verdict`).set('Authorization', `Bearer ${tokenFor(expert._id, 'DOMAIN_EXPERT')}`)
      .send({ result: 'CONFIRMED' }).expect(200)
  })

  it('cảnh báo suy luận mới: farm chưa có chuyên gia thì Farm Owner nhận thông báo chờ kiểm chứng', async () => {
    const { owner, farm, zone } = await seed({ withExpert: false })
    await createAlert({ farmId: String(farm._id), zoneId: String(zone._id), type: 'SENSOR_ANOMALY', title: 'Cảm biến đứng số', message: 'm' })
    const notification = await waitForNotification(owner._id)
    expect(notification?.title).toContain('chờ kiểm chứng')
  })

  it('farm có chuyên gia: thông báo chờ kiểm chứng tới chuyên gia, không tới Farm Owner', async () => {
    const { owner, expert, farm, zone } = await seed({ withExpert: true })
    await createAlert({ farmId: String(farm._id), zoneId: String(zone._id), type: 'SENSOR_ANOMALY', title: 'Cảm biến đứng số', message: 'm' })
    expect((await waitForNotification(expert._id))?.title).toContain('chờ kiểm chứng')
    expect(await Notification.countDocuments({ user_id: owner._id })).toBe(0)
  })

  it('chuyên gia duy nhất bị khoá: Farm Owner làm thay cả 4 quyết định và nhận thông báo chờ kiểm chứng', async () => {
    const { owner, expert, farm, zone, alert, decisions } = await seed({ withExpert: true })
    await User.updateOne({ _id: expert._id }, { is_active: false })

    for (const decide of Object.values(decisions)) await decide().expect(200)
    expect((await Alert.findById(alert._id).lean())!.expert_verdict).toMatchObject({ role: 'FARM_OWNER' })

    await createAlert({ farmId: String(farm._id), zoneId: String(zone._id), type: 'SENSOR_ANOMALY', title: 'Cảm biến đứng số', message: 'm' })
    expect((await waitForNotification(owner._id))?.title).toContain('chờ kiểm chứng')
    expect(await Notification.countDocuments({ user_id: expert._id })).toBe(0)
  })
})
