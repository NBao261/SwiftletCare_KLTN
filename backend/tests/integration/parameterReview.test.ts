/**
 * EXPERT-FR-010, Report 3 §6.10 — mục duyệt thay đổi của Farm Owner trên farm có Domain Expert:
 * thay đổi áp dụng ngay và mở 1 mục PENDING_REVIEW (cập nhật nếu sửa tiếp, giữ giá trị gốc); chuyên gia
 * chấp nhận (ACCEPTED), hoàn lại (REVERTED, lịch sử EXPERT_REVERT) hoặc tự sửa (ADJUSTED); mục đã
 * đóng → 409; Farm Owner, Technician, Administrator không duyệt được (403).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import deviceRoutes from '@/routes/devices.route'
import expertActivityRoutes from '@/routes/expertActivity.route'
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
import { publishCommand } from '@/mqtt/mqtt.client'
import * as thresholdUpdate from '@/utils/thresholdUpdate.util'
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
app.use('/devices', deviceRoutes)
app.use('/farms', farmRoutes)
app.use('/expert-activity', expertActivityRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await ParameterReview.init() // index unique 1 mục chờ mỗi Zone + nhóm
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
afterEach(async () => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  await Promise.all([AuditLog, SensorNode, Farm, House, Zone, Notification, ParameterReview, SystemSetting, User]
    .map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
async function seed({ withExpert = true } = {}) {
  seq++
  const mk = (prefix: string, role: Role, full_name: string) =>
    User.create({ email: `${prefix}${seq}@test.vn`, password_hash: 'password123', full_name, role })
  const [owner, expert, technician, admin] = await Promise.all([
    mk('o', 'FARM_OWNER', 'Chủ'), mk('e', 'DOMAIN_EXPERT', 'Chuyên gia'), mk('t', 'TECHNICIAN', 'KTV'), mk('a', 'ADMIN', 'QT'),
  ])
  const farm = await Farm.create({
    name: 'F', address: 'x', coordinates: { lat: 10, lng: 106 }, owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : [])],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Tầng 1' })
  const node = await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const t = {
    owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT'),
    technician: tokenFor(technician._id, 'TECHNICIAN'), admin: tokenFor(admin._id, 'ADMIN'),
  }
  const send = (method: 'get' | 'put', path: string, token: string, body: object = {}) =>
    request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)
  return { owner, expert, farm, zone, node, t, send }
}

const reviewsOf = (zoneId: unknown) => ParameterReview.find({ zone_id: zoneId }).lean()

describe('mở mục duyệt khi Farm Owner sửa (EXPERT-FR-010)', () => {
  it('sửa ngưỡng: áp dụng ngay, gửi xuống thiết bị, mở 1 mục PENDING_REVIEW cũ/mới, chuyên gia được báo', async () => {
    const { expert, zone, t, send } = await seed()
    await send('put', `/farms/zones/${zone._id}/thresholds`, t.owner, { humidity_min: 78 }).expect(200)

    expect((await Zone.findById(zone._id).lean())!.thresholds.humidity_min).toBe(78)
    expect(publishCommand).toHaveBeenCalled()
    const [review] = await reviewsOf(zone._id)
    expect(review).toMatchObject({ group: 'thresholds', status: 'PENDING_REVIEW' })
    expect(review.old_values.humidity_min).toBe(75)
    expect(review.new_values.humidity_min).toBe(78)
    const notice = await Notification.findOne({ user_id: expert._id }).lean()
    expect(notice?.ref).toMatchObject({ kind: 'parameter_review', id: review._id })
  })

  it('sửa tiếp cùng nhóm (kể cả qua thiết bị, reset): vẫn 1 mục, giữ giá trị gốc', async () => {
    const { zone, node, t, send } = await seed()
    await send('put', `/farms/zones/${zone._id}/thresholds`, t.owner, { humidity_min: 78 }).expect(200)
    await send('put', `/devices/sensor-nodes/${node._id}/thresholds`, t.owner, { humidity_min: 80 }).expect(200)
    await send('put', `/farms/zones/${zone._id}/thresholds`, t.owner, { temp_max: 32 }).expect(200)

    const reviews = await reviewsOf(zone._id)
    expect(reviews).toHaveLength(1)
    expect(reviews[0].old_values).toMatchObject({ humidity_min: 75, temp_max: 31 })
    expect(reviews[0].new_values).toMatchObject({ humidity_min: 80, temp_max: 32 })

    await send('put', `/farms/zones/${zone._id}/thresholds/reset`, t.owner).expect(200)
    expect(await reviewsOf(zone._id)).toHaveLength(1)
  })

  it('hệ số mờ mở mục riêng nhóm fuzzy; farm chưa có chuyên gia thì không mở mục nào', async () => {
    const s = await seed()
    await s.send('put', `/farms/zones/${s.zone._id}/thresholds`, s.t.owner, { humidity_min: 78 }).expect(200)
    await s.send('put', `/farms/zones/${s.zone._id}/fuzzy-tuning`, s.t.owner, { fuzzy_humidity_band: 10 }).expect(200)
    expect((await reviewsOf(s.zone._id)).map(r => r.group).sort()).toEqual(['fuzzy', 'thresholds'])

    const solo = await seed({ withExpert: false })
    await solo.send('put', `/farms/zones/${solo.zone._id}/thresholds`, solo.t.owner, { humidity_min: 78 }).expect(200)
    await solo.send('put', `/farms/zones/${solo.zone._id}/fuzzy-tuning`, solo.t.owner, { fuzzy_humidity_band: 10 }).expect(200)
    expect(await reviewsOf(solo.zone._id)).toHaveLength(0)
  })

  it('2 lần sửa đầu tiên tới cùng lúc: lần mở mục sau gặp E11000 thì ghi giá trị mới vào mục đã mở', async () => {
    const { zone, t, send } = await seed()
    // Giả lập lần sửa kia vừa mở mục (giá trị cũ hơn) ngay trước khi lần này tạo mục
    const realCreate = ParameterReview.create.bind(ParameterReview)
    jest.spyOn(ParameterReview, 'create').mockImplementationOnce((async (doc: Record<string, unknown>) => {
      await realCreate({ ...doc, new_values: { ...(doc.new_values as object), humidity_min: 77 } })
      throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
    }) as never)

    await send('put', `/farms/zones/${zone._id}/thresholds`, t.owner, { humidity_min: 78 }).expect(200)
    const reviews = await reviewsOf(zone._id)
    expect(reviews).toHaveLength(1)
    expect(reviews[0].new_values.humidity_min).toBe(78)
  })
})

describe('chuyên gia duyệt (Report 3 §6.10)', () => {
  async function pending() {
    const s = await seed()
    await s.send('put', `/farms/zones/${s.zone._id}/thresholds`, s.t.owner, { humidity_min: 78 }).expect(200)
    const [review] = await reviewsOf(s.zone._id)
    jest.clearAllMocks()
    return { ...s, review }
  }

  it('chấp nhận → ACCEPTED, giá trị giữ nguyên, Farm Owner được báo', async () => {
    const { owner, zone, review, t, send } = await pending()
    const res = await send('put', `/expert-activity/reviews/${review._id}/accept`, t.expert).expect(200)
    expect(res.body.data).toMatchObject({ status: 'ACCEPTED' })
    expect((await Zone.findById(zone._id).lean())!.thresholds.humidity_min).toBe(78)
    expect(await Notification.exists({ user_id: owner._id, title: /chấp nhận thay đổi ngưỡng/ })).toBeTruthy()
  })

  it('hoàn lại → giá trị gốc, gửi xuống thiết bị, lịch sử EXPERT_REVERT, REVERTED, Farm Owner được báo', async () => {
    const { owner, zone, review, t, send } = await pending()
    await send('put', `/expert-activity/reviews/${review._id}/revert`, t.expert).expect(200)

    const after = (await Zone.findById(zone._id).lean())!
    expect(after.thresholds.humidity_min).toBe(75)
    expect(after.threshold_history.at(-1)).toMatchObject({ source: 'EXPERT_REVERT', changed_by_role: 'DOMAIN_EXPERT' })
    expect(publishCommand).toHaveBeenCalled()
    expect((await ParameterReview.findById(review._id).lean())!.status).toBe('REVERTED')
    expect(await Notification.countDocuments({ user_id: owner._id })).toBe(1)
  })

  it('hoàn lại hệ số mờ khôi phục hệ số gốc với lịch sử EXPERT_REVERT', async () => {
    const s = await seed()
    await s.send('put', `/farms/zones/${s.zone._id}/fuzzy-tuning`, s.t.owner, { fuzzy_humidity_band: 12 }).expect(200)
    const [review] = await reviewsOf(s.zone._id)
    await s.send('put', `/expert-activity/reviews/${review._id}/revert`, s.t.expert).expect(200)
    const after = (await Zone.findById(s.zone._id).lean())!
    expect(after.fuzzy_tuning.fuzzy_humidity_band).toBe(8)
    expect(after.fuzzy_tuning_history.at(-1)!.source).toBe('EXPERT_REVERT')
  })

  it('chấp nhận và hoàn lại cùng lúc: đúng 1 bên thắng, trạng thái mục khớp giá trị Zone', async () => {
    const { zone, review, t, send } = await pending()
    const results = await Promise.all([
      send('put', `/expert-activity/reviews/${review._id}/accept`, t.expert),
      send('put', `/expert-activity/reviews/${review._id}/revert`, t.expert),
    ])
    expect(results.map(r => r.status).sort()).toEqual([200, 409])

    const status = (await ParameterReview.findById(review._id).lean())!.status
    const humidityMin = (await Zone.findById(zone._id).lean())!.thresholds.humidity_min
    expect(status === 'ACCEPTED' ? 78 : 75).toBe(humidityMin)
  })

  it('hoàn lại lỗi khi áp → mục mở lại PENDING_REVIEW, giá trị giữ nguyên, hoàn lại lần sau được', async () => {
    const { zone, review, t, send } = await pending()
    jest.spyOn(thresholdUpdate, 'applyThresholdUpdate').mockRejectedValueOnce(new Error('Mất kết nối DB'))
    await send('put', `/expert-activity/reviews/${review._id}/revert`, t.expert).expect(500)
    expect((await ParameterReview.findById(review._id).lean())!.status).toBe('PENDING_REVIEW')
    expect((await Zone.findById(zone._id).lean())!.thresholds.humidity_min).toBe(78)

    await send('put', `/expert-activity/reviews/${review._id}/revert`, t.expert).expect(200)
    expect((await Zone.findById(zone._id).lean())!.thresholds.humidity_min).toBe(75)
  })

  it('lịch sử hoạt động: hoàn lại là 1 dòng REVIEW_REVERTED; chuyên gia tự sửa ngưỡng vẫn có THRESHOLD_UPDATED', async () => {
    const { farm, zone, review, t, send } = await pending()
    await send('put', `/expert-activity/reviews/${review._id}/revert`, t.expert).expect(200)
    await send('put', `/farms/zones/${zone._id}/thresholds`, t.expert, { humidity_min: 76 }).expect(200)
    const res = await send('get', `/expert-activity?farmId=${farm._id}`, t.owner).expect(200)
    expect(res.body.data.map((e: { action: string }) => e.action)).toEqual(['THRESHOLD_UPDATED', 'REVIEW_REVERTED'])
  })

  it('chuyên gia tự sửa cùng nhóm → ADJUSTED với giá trị mới của chuyên gia', async () => {
    const { zone, review, t, send } = await pending()
    await send('put', `/farms/zones/${zone._id}/thresholds`, t.expert, { humidity_min: 77 }).expect(200)
    expect((await ParameterReview.findById(review._id).lean())!.status).toBe('ADJUSTED')
    expect((await Zone.findById(zone._id).lean())!.thresholds.humidity_min).toBe(77)
  })

  it('mục đã đóng → 409; Farm Owner, Technician, Administrator → 403', async () => {
    const { review, t, send } = await pending()
    for (const token of [t.owner, t.technician, t.admin]) {
      await send('put', `/expert-activity/reviews/${review._id}/accept`, token).expect(403)
    }
    await send('put', `/expert-activity/reviews/${review._id}/accept`, t.expert).expect(200)
    await send('put', `/expert-activity/reviews/${review._id}/accept`, t.expert).expect(409)
    await send('put', `/expert-activity/reviews/${review._id}/revert`, t.expert).expect(409)
  })

  it('danh sách mục duyệt theo farm, lọc trạng thái; quyết định có trong lịch sử hoạt động', async () => {
    const { farm, review, t, send } = await pending()
    await send('put', `/expert-activity/reviews/${review._id}/accept`, t.expert).expect(200)

    const list = await send('get', `/expert-activity/reviews?farmId=${farm._id}&status=ACCEPTED`, t.owner).expect(200)
    expect(list.body.meta.total).toBe(1)
    const activity = await send('get', `/expert-activity?farmId=${farm._id}&type=REVIEW_ACCEPTED`, t.owner).expect(200)
    expect(activity.body.meta.total).toBe(1)
  })
})
