import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { requestContext } from '@/middlewares/requestContext.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { User } from '@/models/user.model'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitHouseDeviceStatusChange: jest.fn(), emitRelayUpdate: jest.fn(),
}))
jest.mock('@/services/telegram.service', () => ({ sendTelegram: jest.fn().mockResolvedValue(undefined) }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use(requestContext)
app.use('/farms', farmRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await ParameterReview.init()
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
afterEach(async () => {
  jest.clearAllMocks()
  await Promise.all([AuditLog, SensorNode, Farm, House, Zone, Notification, ParameterReview, SystemSetting, User]
    .map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) => jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
// Farm có chuyên gia: Farm Owner sửa thì mở mục duyệt và báo chuyên gia; chuyên gia sửa thì báo Farm Owner
async function seed() {
  seq++
  const mk = (prefix: string, role: Role) => User.create({ email: `${prefix}${seq}@test.vn`, password_hash: 'password123', full_name: prefix, role })
  const [owner, expert] = await Promise.all([mk('o', 'FARM_OWNER'), mk('e', 'DOMAIN_EXPERT')])
  const farm = await Farm.create({
    name: 'F', address: 'x', coordinates: { lat: 10, lng: 106 }, owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Tầng 1' })
  // Có bộ điều khiển thì đổi cấu hình mới được gửi xuống
  await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const token = { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') }
  const put = (path: string, who: 'owner' | 'expert', body: object = {}) =>
    request(app).put(path).set('Authorization', `Bearer ${token[who]}`).send(body)
  return { owner, expert, house, zone, put }
}

// Mọi thứ một lần đổi để lại: lịch sử, cấu hình gửi thiết bị, nhật ký, thông báo, mục duyệt
async function sideEffects(ownerId: unknown, expertId: unknown) {
  return {
    audits: await AuditLog.countDocuments({ action: /UPDATED/ }),
    reviews: await ParameterReview.countDocuments(),
    toExpert: await Notification.countDocuments({ user_id: expertId }),
    toOwner: await Notification.countDocuments({ user_id: ownerId }),
    published: (publishDeviceConfig as jest.Mock).mock.calls.length,
  }
}

const NOTHING = { audits: 0, reviews: 0, toExpert: 0, toOwner: 0, published: 0 }

describe('không đổi gì thì không ghi, không gửi thiết bị, không báo ai', () => {
  it('khôi phục ngưỡng về mặc định khi đang là mặc định', async () => {
    const { owner, expert, zone, put } = await seed()
    await put(`/farms/zones/${zone._id}/thresholds/reset`, 'owner').expect(200)
    await put(`/farms/zones/${zone._id}/thresholds/reset`, 'expert').expect(200)
    expect(await sideEffects(owner._id, expert._id)).toEqual(NOTHING)
    expect((await Zone.findById(zone._id).lean())!.threshold_history).toHaveLength(0)
  })

  it('lưu ngưỡng giống hệt ngưỡng đang áp dụng, kể cả gửi lại một phần', async () => {
    const { owner, expert, zone, put } = await seed()
    const current = (await Zone.findById(zone._id).lean())!.thresholds
    await put(`/farms/zones/${zone._id}/thresholds`, 'owner', { humidity_min: current.humidity_min }).expect(200)
    await put(`/farms/zones/${zone._id}/thresholds`, 'expert', { temp_min: current.temp_min, temp_max: current.temp_max }).expect(200)
    expect(await sideEffects(owner._id, expert._id)).toEqual(NOTHING)
  })

  it('một thay đổi thật vẫn báo chuyên gia, mở mục duyệt và gửi thiết bị', async () => {
    const { owner, expert, zone, put } = await seed()
    await put(`/farms/zones/${zone._id}/thresholds`, 'owner', { humidity_min: 78 }).expect(200)
    expect(await sideEffects(owner._id, expert._id)).toMatchObject({ audits: 1, reviews: 1, toExpert: 1 })
    expect((publishDeviceConfig as jest.Mock).mock.calls.length).toBeGreaterThan(0)
  })

  it('khôi phục về mặc định sau khi đã sửa là một thay đổi thật', async () => {
    const { owner, expert, zone, put } = await seed()
    await put(`/farms/zones/${zone._id}/thresholds`, 'expert', { humidity_min: 78 }).expect(200)
    const before = await sideEffects(owner._id, expert._id)
    await put(`/farms/zones/${zone._id}/thresholds/reset`, 'expert').expect(200)
    const after = await sideEffects(owner._id, expert._id)
    expect(after.audits).toBe(before.audits + 1)
    expect(after.toOwner).toBe(before.toOwner + 1)
    expect((await Zone.findById(zone._id).lean())!.thresholds.humidity_min).toBe(75)
  })

  it('hệ số mờ: lưu lại đúng hệ số đang áp dụng', async () => {
    const { owner, expert, zone, put } = await seed()
    const current = (await Zone.findById(zone._id).lean())!.fuzzy_tuning
    await put(`/farms/zones/${zone._id}/fuzzy-tuning`, 'owner', { fuzzy_humidity_band: current.fuzzy_humidity_band, fuzzy_input_filter: current.fuzzy_input_filter }).expect(200)
    expect(await sideEffects(owner._id, expert._id)).toEqual(NOTHING)
  })

  it('tham số phát hiện: khôi phục mặc định khi đang là mặc định, và lưu giá trị cũ', async () => {
    const { owner, expert, zone, put } = await seed()
    await put(`/farms/zones/${zone._id}/detection-tuning/reset`, 'owner').expect(200)
    await put(`/farms/zones/${zone._id}/detection-tuning`, 'expert', { noise_margin_db: 15 }).expect(200)
    expect(await sideEffects(owner._id, expert._id)).toEqual(NOTHING)
    expect((await Zone.findById(zone._id).lean())!.detection_tuning_history).toHaveLength(0)
  })

  it('mức giảm tỷ lệ chim về: khôi phục mặc định khi đang là mặc định', async () => {
    const { owner, expert, house, put } = await seed()
    await put(`/farms/houses/${house._id}/bird-count-tuning/reset`, 'owner').expect(200)
    await put(`/farms/houses/${house._id}/bird-count-tuning`, 'expert', { return_rate_drop_pct: 20 }).expect(200)
    expect(await sideEffects(owner._id, expert._id)).toEqual(NOTHING)
    expect((await House.findById(house._id).lean())!.bird_count_tuning_history).toHaveLength(0)
  })

  it('mức chỉ số sức khoẻ: lưu lại đúng mức đang áp dụng', async () => {
    const { owner, expert, house, put } = await seed()
    await put(`/farms/houses/${house._id}/health-levels`, 'owner', { noise_clear: 3, air_slight_h: 1 }).expect(200)
    expect(await sideEffects(owner._id, expert._id)).toEqual(NOTHING)
  })

  it('lịch đếm: lưu lại lịch trống khi chưa có lịch nào, rồi lưu lại đúng lịch đang áp dụng', async () => {
    const { owner, expert, house, put } = await seed()
    await put(`/farms/houses/${house._id}/counting-schedule`, 'owner', { profiles: [], temporary: [] }).expect(200)
    const temporary = [{ from: '2026-12-01', to: '2026-12-01', morning: { start: '05:00', end: '07:00' }, evening: { start: '17:00', end: '19:00' } }]
    await put(`/farms/houses/${house._id}/counting-schedule`, 'expert', { temporary }).expect(200)
    const afterReal = await sideEffects(owner._id, expert._id)
    expect(afterReal.audits).toBe(1)
    jest.clearAllMocks()
    await put(`/farms/houses/${house._id}/counting-schedule`, 'expert', { temporary }).expect(200)
    expect(await sideEffects(owner._id, expert._id)).toMatchObject({ audits: 1, published: 0 })
    expect((await House.findById(house._id).lean())!.counting_schedule_history).toHaveLength(1)
  })
})
