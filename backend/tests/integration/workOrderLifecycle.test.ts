/**
 * OPS-FR-001…004, ALERT-FR-018, BR-39…41 (Report 3 §6.19, SM-19) — Work Order sửa chữa: mở tự động theo cảnh báo
 * thiết bị, giao thợ đang trực; thợ bắt đầu, báo xong kèm nguyên nhân và ảnh; hệ thống kiểm dữ liệu phục hồi
 * 10 phút; Farm Owner duyệt, mở lại, huỷ, giao lại; tự phục hồi trước khi làm; mất kết nối quá 30 phút;
 * chuyên gia xác nhận cần tới nhà.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
import workOrderRoutes from '@/routes/workOrders.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { WorkOrder } from '@/models/workOrder.model'
import { putObject } from '@/config/minio.config'
import { createAlert } from '@/services/alert.service'
import { notifyUser } from '@/services/notification.service'
import { openWorkOrdersForOutages, verifyWorkOrders } from '@/services/workOrder.service'
import type { AlertType, Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/socket', () => ({ emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn() }))
jest.mock('@/config/minio.config', () => ({
  putObject: jest.fn().mockResolvedValue(undefined),
  presignedGetUrl: jest.fn(async (key: string) => `http://minio.test/${key}`),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/alerts', alertRoutes)
app.use('/work-orders', workOrderRoutes)
app.use(errorHandler)

useTestDb()

let seq = 0
async function account(role: Role) {
  seq++
  const user = await User.create({ email: `wo${seq}@test.vn`, password_hash: 'password123', full_name: `${role}${seq}`, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}
const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object = {}) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  upload: (path: string) => request(app).post(path).set('Authorization', `Bearer ${token}`),
})

/** Farm có nhà H (thợ T chính, thợ T2 phụ), nhà H2 (thợ khác X), 1 Domain Expert */
async function seed(withTechnician = true) {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const house2 = await House.create({ farm_id: ctx.farm._id, name: 'H2' })
  const [tech, tech2, other, expert] = [
    await account('FARM_TECHNICIAN'), await account('FARM_TECHNICIAN'), await account('FARM_TECHNICIAN'), await account('DOMAIN_EXPERT'),
  ]
  for (const t of [tech, tech2, other]) ctx.farm.members.push({ user_id: t.user._id, role: 'FARM_TECHNICIAN' } as never)
  ctx.farm.members.push({ user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never)
  await ctx.farm.save()
  if (withTechnician) {
    house.technicians = [{ user_id: tech.user._id, primary: true }, { user_id: tech2.user._id, primary: false }] as never
    await house.save()
  }
  house2.technicians = [{ user_id: other.user._id, primary: true }] as never
  await house2.save()
  const raise = (type: AlertType) => createAlert({
    farmId: String(ctx.farm._id), zoneId: String(ctx.zone._id), nodeId: String(ctx.node._id),
    type, title: `${type} tại Z`, message: 'chi tiết',
  })
  return {
    ...ctx, house, house2, tech, tech2, other, expert, raise,
    owner$: as(ctx.token), tech$: as(tech.token), other$: as(other.token), expert$: as(expert.token),
  }
}

const ago = (min: number) => new Date(Date.now() - min * 60_000)
const later = (min: number) => new Date(Date.now() + min * 60_000)

describe('mở Work Order (OPS-FR-001, BR-39)', () => {
  it('MISTING_INEFFECTIVE mở đúng 1 Work Order giao thợ đang trực; lặp lại cùng sự cố không mở thêm', async () => {
    const { house, tech, raise } = await seed()
    const alert = (await raise('MISTING_INEFFECTIVE'))!
    const orders = await WorkOrder.find().lean()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({
      alert_id: alert._id, house_id: house._id, status: 'OPEN', origin: 'ALERT', assignee_id: tech.user._id, is_open: true,
    })
    expect(notifyUser).toHaveBeenCalledWith(String(tech.user._id), expect.objectContaining({ ref: { kind: 'work_order', id: String(orders[0]._id) } }))

    await Alert.collection.updateOne({ _id: alert._id }, { $set: { last_seen_at: ago(5) } })
    expect(await raise('MISTING_INEFFECTIVE')).toBeNull()
    expect(await WorkOrder.countDocuments()).toBe(1)
  })

  it('nhà không có thợ: Work Order không giao ai, Farm Owner được báo', async () => {
    const { owner, raise } = await seed(false)
    await raise('SPEAKER_FAILURE')
    const wo = (await WorkOrder.findOne().lean())!
    expect(wo.assignee_id).toBeUndefined()
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ ref: expect.objectContaining({ kind: 'work_order' }) }))
  })

  it('ACTUATOR_FAULT của bơm và của quạt trên cùng controller mở hai Work Order (THREAT-FR-014)', async () => {
    const { farm, zone, node } = await seed()
    const fault = (load: string) => createAlert({
      farmId: String(farm._id), zoneId: String(zone._id), nodeId: String(node._id), type: 'ACTUATOR_FAULT',
      title: `ACTUATOR_FAULT ${load}`, message: 'tải không theo relay', details: { load },
    })
    await fault('misting')
    await fault('ventilation')
    expect(await Alert.countDocuments({ type: 'ACTUATOR_FAULT' })).toBe(2)
    const orders = await WorkOrder.find({ alert_type: 'ACTUATOR_FAULT' }).lean()
    expect(orders).toHaveLength(2)
    expect(new Set(orders.map(o => String(o.alert_id))).size).toBe(2)
  })

  it('cảnh báo đo trực tiếp khác (vượt ngưỡng) không mở Work Order', async () => {
    const { raise } = await seed()
    await raise('THRESHOLD_BREACH')
    await raise('UNEXPECTED_RESTART')
    expect(await WorkOrder.countDocuments()).toBe(0)
  })

  it('Farm Owner mở tay; thợ hay chuyên gia mở → 403; cảnh báo đã có Work Order đang mở → 409', async () => {
    const { house, house2, tech, owner$, tech$, expert$, raise } = await seed()
    const body = { house_id: String(house._id), title: 'Thay béc phun' }
    await tech$.post('/work-orders', body).expect(403)
    await expert$.post('/work-orders', body).expect(403)
    const res = await owner$.post('/work-orders', { ...body, description: 'Béc 3 bị tắc' }).expect(201)
    expect(res.body.data).toMatchObject({ origin: 'MANUAL', status: 'OPEN', assignee: { _id: String(tech.user._id) }, photo_urls: [] })

    const alert = (await raise('ACTUATOR_FAULT'))!
    await owner$.post('/work-orders', { ...body, alert_id: String(alert._id) }).expect(409)
    await owner$.post('/work-orders', { house_id: String(house2._id), title: 'x', alert_id: String(alert._id) }).expect(400)
  })

  it('NODE_OFFLINE còn mở sau 30 phút mở Work Order 1 lần (BR-39)', async () => {
    const { raise } = await seed()
    const alert = (await raise('NODE_OFFLINE'))!
    expect(await openWorkOrdersForOutages()).toBe(0)
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { created_at: ago(31) } })
    expect(await openWorkOrdersForOutages()).toBe(1)
    expect(await openWorkOrdersForOutages()).toBe(0)
    expect((await WorkOrder.findOne().lean())!).toMatchObject({ origin: 'OUTAGE', alert_type: 'NODE_OFFLINE' })
  })

  it('chuyên gia xác nhận cảnh báo suy luận cần tới nhà mở Work Order; bác bỏ kèm needs_visit → 422', async () => {
    const { expert$, raise } = await seed()
    const alert = (await raise('SENSOR_ANOMALY'))!
    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED', note: 'nhầm', needs_visit: true }).expect(422)
    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'CONFIRMED', needs_visit: true }).expect(200)
    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'CONFIRMED', needs_visit: true }).expect(200)
    const orders = await WorkOrder.find().lean()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ origin: 'EXPERT', alert_id: alert._id })
  })
})

describe('vòng đời Work Order (OPS-FR-002…004, BR-41)', () => {
  async function started() {
    const ctx = await seed()
    const alert = (await ctx.raise('MISTING_INEFFECTIVE'))!
    const wo = (await WorkOrder.findOne())!
    const path = `/work-orders/${wo._id}`
    await ctx.other$.post(`${path}/start`).expect(403)
    await ctx.tech$.post(`${path}/start`).expect(200)
    return { ...ctx, alert, wo, path }
  }

  it('thợ bắt đầu, báo xong kèm nguyên nhân và ảnh → VERIFYING; dữ liệu phục hồi 10 phút → chờ duyệt; Farm Owner duyệt → CLOSED và đóng cảnh báo', async () => {
    const { owner, tech, tech$, owner$, alert, path } = await started()
    await tech$.post(`${path}/start`).expect(409)
    // ALERT-FR-018 — thiếu nguyên nhân → 422
    await tech$.post(`${path}/done`, { work_note: 'đã thông béc' }).expect(422)
    const done = await tech$.upload(`${path}/done`)
      .field('cause', 'NOZZLE').field('work_note', 'Thông béc 3')
      .attach('photos', Buffer.from('jpeg'), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(200)
    expect(done.body.data).toMatchObject({ status: 'VERIFYING', cause: 'NOZZLE', work_note: 'Thông béc 3' })
    expect(done.body.data.photo_urls).toHaveLength(1)
    expect(putObject).toHaveBeenCalledTimes(1)
    expect((await Alert.findById(alert._id).lean())!.site_cause).toMatchObject({ cause: 'NOZZLE', by: tech.user._id })
    await owner$.post(`${path}/approve`).expect(409)

    // Cảnh báo còn mở: chưa phục hồi
    expect((await verifyWorkOrders(later(20))).verified).toBe(0)
    await Alert.updateOne({ _id: alert._id }, { status: 'RESOLVED', resolved_at: new Date() })
    expect((await verifyWorkOrders(later(5))).verified).toBe(0)
    expect((await verifyWorkOrders(later(11))).verified).toBe(1)
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ title: expect.stringContaining('chờ duyệt') }))

    await tech$.post(`${path}/approve`).expect(403)
    const approved = await owner$.post(`${path}/approve`).expect(200)
    expect(approved.body.data).toMatchObject({ status: 'CLOSED', result: 'REPAIRED' })
    expect(approved.body.data.history.map((h: { to: string }) => h.to))
      .toEqual(['OPEN', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_APPROVAL', 'CLOSED'])
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
    expect(approved.body.data.closed_at).toBeTruthy()
  })

  it('sự cố quay lại trong lúc kiểm → IN_PROGRESS, không mở Work Order thứ hai (OPS-FR-003)', async () => {
    const { tech, tech$, raise, alert, path, wo } = await started()
    await tech$.post(`${path}/done`, { cause: 'PUMP' }).expect(200)
    await Alert.updateOne({ _id: alert._id }, { status: 'RESOLVED', resolved_at: new Date() })
    const again = (await raise('MISTING_INEFFECTIVE'))!
    expect(await WorkOrder.countDocuments()).toBe(1)
    expect((await WorkOrder.findById(wo._id).lean())!).toMatchObject({ status: 'IN_PROGRESS', alert_id: again._id })
    expect(notifyUser).toHaveBeenCalledWith(String(tech.user._id), expect.objectContaining({ title: expect.stringContaining('Sự cố quay lại') }))
  })

  it('Farm Owner mở lại kèm ghi chú (thiếu → 422), huỷ kèm lý do, giao lại cho thợ của nhà', async () => {
    const { tech2, other, owner$, tech$, alert, path } = await started()
    await tech$.post(`${path}/done`, { cause: 'WATER' }).expect(200)
    await Alert.updateOne({ _id: alert._id }, { status: 'RESOLVED', resolved_at: ago(15) })
    // 10 phút tính từ lúc báo xong, không từ lúc cảnh báo đóng (BR-41)
    expect((await verifyWorkOrders()).verified).toBe(0)
    expect((await verifyWorkOrders(later(11))).verified).toBe(1)
    await owner$.post(`${path}/reopen`, {}).expect(422)
    const reopened = await owner$.post(`${path}/reopen`, { note: 'Béc 2 vẫn yếu' }).expect(200)
    expect(reopened.body.data.status).toBe('IN_PROGRESS')
    expect(reopened.body.data.history.at(-1)).toMatchObject({ to: 'IN_PROGRESS', note: 'Béc 2 vẫn yếu' })

    await owner$.post(`${path}/reassign`, { assignee_id: String(other.user._id) }).expect(400)
    const moved = await owner$.post(`${path}/reassign`, { assignee_id: String(tech2.user._id) }).expect(200)
    expect(moved.body.data.assignee._id).toBe(String(tech2.user._id))

    await owner$.post(`${path}/cancel`, {}).expect(422)
    const cancelled = await owner$.post(`${path}/cancel`, { reason: 'Thay cả cụm bơm' }).expect(200)
    expect(cancelled.body.data).toMatchObject({ status: 'CANCELLED', cancel_reason: 'Thay cả cụm bơm', is_open: false })
    await owner$.post(`${path}/cancel`, { reason: 'x' }).expect(409)
  })

  it('cảnh báo tự phục hồi trước khi bắt đầu → CLOSED "self-recovered"', async () => {
    const { raise } = await seed()
    const alert = (await raise('MISTING_INEFFECTIVE'))!
    await WorkOrder.updateMany({}, { opened_at: ago(20) })
    await Alert.updateOne({ _id: alert._id }, { status: 'RESOLVED', resolved_at: ago(11) })
    expect((await verifyWorkOrders()).selfRecovered).toBe(1)
    expect((await WorkOrder.findOne().lean())!).toMatchObject({ status: 'CLOSED', result: 'SELF_RECOVERED', is_open: false })
  })

  it('chưa ai bắt đầu sau 15 phút → báo Farm Owner 1 lần (BR-40)', async () => {
    const { owner, raise } = await seed()
    await raise('MISTING_INEFFECTIVE')
    await WorkOrder.updateMany({}, { opened_at: ago(16) })
    ;(notifyUser as jest.Mock).mockClear()
    expect((await verifyWorkOrders()).escalated).toBe(1)
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ title: expect.stringContaining('chưa ai bắt đầu') }))
    expect((await verifyWorkOrders()).escalated).toBe(0)
  })

  it('ảnh sai định dạng → 400; Work Order không gắn cảnh báo báo xong thì chờ duyệt ngay', async () => {
    const { house, owner$, tech$ } = await seed()
    const wo = (await owner$.post('/work-orders', { house_id: String(house._id), title: 'Sơn lại cửa' }).expect(201)).body.data
    await tech$.post(`/work-orders/${wo._id}/start`).expect(200)
    await tech$.upload(`/work-orders/${wo._id}/done`)
      .attach('photos', Buffer.from('x'), { filename: 'a.gif', contentType: 'image/gif' }).expect(400)
    const done = await tech$.post(`/work-orders/${wo._id}/done`, { work_note: 'xong' }).expect(200)
    expect(done.body.data.status).toBe('AWAITING_APPROVAL')
  })
})

describe('kiểm phục hồi theo loại cảnh báo (BR-41, OPS-FR-003)', () => {
  const at = (d: Date, min: number) => new Date(d.getTime() + min * 60_000)
  const FULL = { temperature: 28, humidity: 85, light_lux: 0.1, nh3_ppm: 5, co2_ppm: 800, sound_db: 40 }

  async function doneOn(type: AlertType, cause: string) {
    const ctx = await seed()
    const alert = (await ctx.raise(type))!
    const wo = (await WorkOrder.findOne())!
    const path = `/work-orders/${wo._id}`
    await ctx.tech$.post(`${path}/start`).expect(200)
    await ctx.tech$.post(`${path}/done`, { cause }).expect(200)
    const doneAt = (await WorkOrder.findById(wo._id).lean())!.done_at!
    /** Mẫu telemetry mỗi phút, phút `fromMin`…`toMin` sau lúc báo xong */
    const samples = (fromMin: number, toMin: number, values: (minute: number) => object = () => FULL) =>
      Telemetry.insertMany(Array.from({ length: toMin - fromMin + 1 }, (_, i) => ({
        node_id: ctx.node._id, zone_id: ctx.zone._id, timestamp: at(doneAt, fromMin + i), ...values(fromMin + i),
      })))
    const status = async () => (await WorkOrder.findById(wo._id).lean())!.status
    return { ...ctx, alert, wo, path, doneAt, samples, status }
  }

  it('MISTING_INEFFECTIVE: độ ẩm về trên humidity_min 10 phút sau khi báo xong → chờ duyệt, dù cảnh báo chưa tự đóng', async () => {
    const { doneAt, samples, status } = await doneOn('MISTING_INEFFECTIVE', 'NOZZLE')
    // Phút 2 còn khô (dưới humidity_min 75): tính lại từ mẫu đó
    await samples(0, 9, minute => ({ ...FULL, humidity: minute === 2 ? 70 : 85 }))
    expect((await verifyWorkOrders(at(doneAt, 10))).verified).toBe(0)
    await samples(10, 12)
    expect((await verifyWorkOrders(at(doneAt, 12))).verified).toBe(1)
    expect(await status()).toBe('AWAITING_APPROVAL')
  })

  it('SENSOR_FAULT: đủ số đo của 5 cảm biến 10 phút → chờ duyệt; thiếu 1 số đo thì tính lại từ mẫu đó', async () => {
    const { doneAt, samples, status } = await doneOn('SENSOR_FAULT', 'SENSOR')
    await samples(0, 11, minute => (minute === 5 ? { ...FULL, co2_ppm: undefined } : FULL))
    expect((await verifyWorkOrders(at(doneAt, 12))).verified).toBe(0)
    await samples(12, 16)
    expect((await verifyWorkOrders(at(doneAt, 16))).verified).toBe(1)
    expect(await status()).toBe('AWAITING_APPROVAL')
  })

  it('controller báo lại sự cố sau lúc báo xong (cảnh báo gộp trùng) → IN_PROGRESS, báo thợ', async () => {
    const { tech, alert, doneAt, samples, status } = await doneOn('RS485_BUS_FAILURE', 'SENSOR')
    await samples(0, 12)
    await Alert.collection.updateOne({ _id: alert._id }, { $set: { last_seen_at: at(doneAt, 2) } })
    ;(notifyUser as jest.Mock).mockClear()
    expect((await verifyWorkOrders(at(doneAt, 12))).verified).toBe(0)
    expect(await status()).toBe('IN_PROGRESS')
    expect(notifyUser).toHaveBeenCalledWith(String(tech.user._id), expect.objectContaining({ title: expect.stringContaining('Sự cố quay lại') }))
  })

  it('ACTUATOR_FAULT: không gửi lại trong 1 chu kỳ 15 phút → chờ duyệt, không phải chờ cảnh báo tự đóng sau 60 phút', async () => {
    const { doneAt, status } = await doneOn('ACTUATOR_FAULT', 'PUMP')
    expect((await verifyWorkOrders(at(doneAt, 11))).verified).toBe(0)
    expect((await verifyWorkOrders(at(doneAt, 16))).verified).toBe(1)
    expect(await status()).toBe('AWAITING_APPROVAL')
  })

  it('SPEAKER_FAILURE: không báo lại 10 phút → chuyển Farm Owner duyệt, không kẹt ở VERIFYING', async () => {
    const { doneAt, status } = await doneOn('SPEAKER_FAILURE', 'SPEAKER')
    expect((await verifyWorkOrders(at(doneAt, 5))).verified).toBe(0)
    expect((await verifyWorkOrders(at(doneAt, 11))).verified).toBe(1)
    expect(await status()).toBe('AWAITING_APPROVAL')
  })

  it('sự cố tái phát khi đang chờ duyệt → IN_PROGRESS; Farm Owner không duyệt được, cảnh báo mới vẫn mở', async () => {
    const { alert, doneAt, raise, owner$, path, status } = await doneOn('SPEAKER_FAILURE', 'SPEAKER')
    expect((await verifyWorkOrders(at(doneAt, 11))).verified).toBe(1)
    await Alert.updateOne({ _id: alert._id }, { status: 'RESOLVED', resolved_at: new Date() })
    const again = (await raise('SPEAKER_FAILURE'))!
    expect(await WorkOrder.countDocuments()).toBe(1)
    expect(await status()).toBe('IN_PROGRESS')
    expect((await WorkOrder.findOne().lean())!.alert_id).toEqual(again._id)
    await owner$.post(`${path}/approve`).expect(409)
    expect((await Alert.findById(again._id).lean())!.status).toBe('ACTIVE')
  })

  it('Work Order mở tay trên cảnh báo đã đóng từ trước không tự đóng "self-recovered"', async () => {
    const { house, owner$, raise } = await seed()
    const alert = (await raise('THRESHOLD_BREACH'))!
    await Alert.updateOne({ _id: alert._id }, { status: 'RESOLVED', resolved_at: ago(30), last_seen_at: ago(35) })
    await owner$.post('/work-orders', { house_id: String(house._id), title: 'Kiểm lại quạt', alert_id: String(alert._id) }).expect(201)
    expect((await verifyWorkOrders(later(20))).selfRecovered).toBe(0)
    expect((await WorkOrder.findOne().lean())!.status).toBe('OPEN')
  })

  it('tối đa 5 ảnh cho cả Work Order, tính cả ảnh của lần báo xong trước khi bị mở lại (Report 3 §4.5)', async () => {
    const { house, owner$, tech$ } = await seed()
    const wo = (await owner$.post('/work-orders', { house_id: String(house._id), title: 'Sửa cửa' }).expect(201)).body.data
    const path = `/work-orders/${wo._id}`
    const withPhotos = (n: number) => {
      const req = tech$.upload(`${path}/done`).field('work_note', 'xong')
      for (let i = 0; i < n; i++) req.attach('photos', Buffer.from('jpeg'), { filename: `p${i}.jpg`, contentType: 'image/jpeg' })
      return req
    }
    await tech$.post(`${path}/start`).expect(200)
    await withPhotos(3).expect(200)
    await owner$.post(`${path}/reopen`, { note: 'Cửa còn kẹt' }).expect(200)
    await withPhotos(3).expect(400)
    const done = await withPhotos(2).expect(200)
    expect(done.body.data.photo_urls).toHaveLength(5)
  })

  it('giao lại sau khi đã báo trễ thì Farm Owner không bị báo trễ lần nữa (BR-40)', async () => {
    const { tech2, owner$, raise } = await seed()
    await raise('MISTING_INEFFECTIVE')
    await WorkOrder.updateMany({}, { opened_at: ago(16) })
    expect((await verifyWorkOrders()).escalated).toBe(1)
    const wo = (await WorkOrder.findOne().lean())!
    await owner$.post(`/work-orders/${wo._id}/reassign`, { assignee_id: String(tech2.user._id) }).expect(200)
    expect((await verifyWorkOrders()).escalated).toBe(0)
  })
})

describe('đọc Work Order', () => {
  it('thợ chỉ thấy Work Order của nhà được giao; lọc theo cảnh báo; chuyên gia chỉ đọc', async () => {
    const { farm, tech$, other$, expert$, owner$, raise } = await seed()
    const alert = (await raise('MISTING_INEFFECTIVE'))!
    const wo = (await WorkOrder.findOne().lean())!
    expect((await tech$.get('/work-orders').expect(200)).body.data).toHaveLength(1)
    expect((await other$.get('/work-orders').expect(200)).body.data).toHaveLength(0)
    await other$.get(`/work-orders/${wo._id}`).expect(403)
    expect((await owner$.get(`/work-orders?alertId=${alert._id}&open=true`).expect(200)).body.meta.total).toBe(1)
    expect((await expert$.get(`/work-orders?farmId=${farm._id}`).expect(200)).body.data).toHaveLength(1)
    await expert$.post(`/work-orders/${wo._id}/start`).expect(403)
    expect((await tech$.get('/work-orders?assigneeId=me').expect(200)).body.data).toHaveLength(1)
  })

  it('zone của nhà khác không mở Work Order cho nhà này', async () => {
    const { farm, house2 } = await seed()
    const zone2 = await Zone.create({ house_id: house2._id, name: 'Z2' })
    await createAlert({ farmId: String(farm._id), zoneId: String(zone2._id), type: 'SPEAKER_FAILURE', title: 't', message: 'm' })
    expect((await WorkOrder.findOne().lean())!.house_id).toEqual(house2._id)
  })
})
