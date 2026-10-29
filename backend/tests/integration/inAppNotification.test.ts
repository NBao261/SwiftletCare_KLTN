/**
 * EXPERT-FR-006/007 — hộp thông báo trong ứng dụng: lưu DB + socket NOTIFICATION_NEW, đọc/đánh dấu
 * đã đọc chỉ trên thông báo của chính mình; cảnh báo suy luận mới báo Domain Expert trong ứng dụng.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import notificationRoutes from '@/routes/notifications.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { ZoneHealthReport } from '@/models/zoneHealthReport.model'
import { createAlert } from '@/services/alert.service'
import { generateWeeklyReports } from '@/services/healthReport.service'
import { notifyUser } from '@/services/notification.service'
import { sendTelegram } from '@/services/telegram.service'
import { emitNotificationNew } from '@/socket'
import type { AlertType, Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitAlertNew: jest.fn(), emitNotificationNew: jest.fn() }))
jest.mock('@/services/telegram.service', () => ({ sendTelegram: jest.fn().mockResolvedValue(undefined) }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/notifications', notificationRoutes)
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
  await Promise.all([Alert, Farm, House, Zone, Notification, Telemetry, User, ZoneHealthReport]
    .map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
/** Thông báo gửi kiểu "bắn rồi quên" — chờ tới khi đủ số bản ghi */
async function waitForNotifications(count: number) {
  for (let i = 0; i < 50 && (await Notification.countDocuments()) < count; i++) await new Promise(r => setTimeout(r, 20))
}

let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER', telegram_chat_id: `tg-o${seq}` })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT', telegram_chat_id: `tg-e${seq}` })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  return { owner, expert, farm, zone }
}

const alertOf = (farmId: unknown, zoneId: unknown, type: AlertType) =>
  createAlert({ farmId: String(farmId), zoneId: String(zoneId), type, title: `${type} tại Z`, message: 'chi tiết' })

describe('hộp thông báo (REST)', () => {
  it('notifyUser ghi vào hộp + phát socket; list có unreadCount; đọc 1 cái; đọc hết', async () => {
    const { owner } = await seed()
    await notifyUser(String(owner._id), { title: 'A', body: 'a' })
    await notifyUser(String(owner._id), { title: 'B', body: 'b' })
    expect(emitNotificationNew).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ title: 'B', read_at: null }))

    const token = tokenFor(owner._id, 'FARM_OWNER')
    const list = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`).expect(200)
    expect(list.body.data.map((n: { title: string }) => n.title)).toEqual(['B', 'A'])
    expect(list.body.meta).toMatchObject({ total: 2, unreadCount: 2 })
    expect(list.body.data[0]).not.toHaveProperty('user_id')

    const id = list.body.data[0]._id as string
    const read = await request(app).put(`/notifications/${id}/read`).set('Authorization', `Bearer ${token}`).expect(200)
    const firstReadAt = read.body.data.read_at as string
    expect(firstReadAt).toBeTruthy()
    const again = await request(app).put(`/notifications/${id}/read`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(again.body.data.read_at).toBe(firstReadAt) // giữ thời điểm đọc đầu tiên

    const unread = await request(app).get('/notifications?unread=true').set('Authorization', `Bearer ${token}`).expect(200)
    expect(unread.body.meta).toMatchObject({ total: 1, unreadCount: 1 })

    const all = await request(app).put('/notifications/read-all').set('Authorization', `Bearer ${token}`).expect(200)
    expect(all.body.data).toEqual({ modified: 1 })
    expect(await Notification.countDocuments({ read_at: null })).toBe(0)
  })

  it('không đọc được thông báo của người khác; tham số sai → 422/400', async () => {
    const { owner, expert } = await seed()
    await notifyUser(String(owner._id), { title: 'riêng', body: 'x' })
    const mine = (await Notification.findOne().lean())!

    const expertToken = tokenFor(expert._id, 'DOMAIN_EXPERT')
    await request(app).put(`/notifications/${mine._id}/read`).set('Authorization', `Bearer ${expertToken}`).expect(404)
    const list = await request(app).get('/notifications').set('Authorization', `Bearer ${expertToken}`).expect(200)
    expect(list.body.data).toHaveLength(0)

    const bad = await request(app).get('/notifications?unread=yes').set('Authorization', `Bearer ${expertToken}`)
    expect(bad.status).toBeGreaterThanOrEqual(400)
    await request(app).get('/notifications').expect(401)
  })

  it('tài khoản bị vô hiệu hoá (emailOnly) không có thông báo trong hộp', async () => {
    const { owner } = await seed()
    await notifyUser(String(owner._id), { title: 'khoá', body: 'x' }, { emailOnly: true })
    expect(await Notification.countDocuments()).toBe(0)
  })
})

describe('EXPERT-FR-007 — cảnh báo suy luận chờ kiểm chứng', () => {
  it('cảnh báo suy luận mới → chỉ Domain Expert có thông báo trong ứng dụng, không qua Telegram', async () => {
    const { owner, expert, farm, zone } = await seed()
    const alert = (await alertOf(farm._id, zone._id, 'NOISE_ANOMALY'))!
    await waitForNotifications(1)

    const rows = await Notification.find().lean()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ user_id: expert._id, ref: { kind: 'alert', id: alert._id } })
    expect(await Notification.countDocuments({ user_id: owner._id })).toBe(0)
    // Telegram chỉ tới chủ farm (cảnh báo vận hành), không tới chuyên gia
    expect(sendTelegram).not.toHaveBeenCalledWith(expert.telegram_chat_id, expect.anything())
  })

  it('cảnh báo đo trực tiếp (không suy luận) không báo chuyên gia', async () => {
    const { farm, zone } = await seed()
    await alertOf(farm._id, zone._id, 'MISTING_INEFFECTIVE')
    await new Promise(r => setTimeout(r, 100))
    expect(await Notification.countDocuments()).toBe(0)
  })

  it('báo cáo sức khỏe mới → chủ farm và chuyên gia đều có thông báo kèm ref', async () => {
    const { owner, expert, zone } = await seed()
    await Telemetry.create({ zone_id: zone._id, node_id: new mongoose.Types.ObjectId(), timestamp: new Date(Date.now() - 3600_000), temperature: 29, humidity: 80 })
    expect(await generateWeeklyReports()).toBe(1)

    const rows = await Notification.find({ 'ref.kind': 'health_report' }).lean()
    expect(rows.map(r => String(r.user_id)).sort()).toEqual([String(owner._id), String(expert._id)].sort())
  })
})
