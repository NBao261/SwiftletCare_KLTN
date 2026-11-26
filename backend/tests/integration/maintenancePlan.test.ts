import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import maintenanceRoutes from '@/routes/maintenance.route'
import workOrderRoutes from '@/routes/workOrders.route'
import alertRoutes from '@/routes/alerts.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { House } from '@/models/houseZone.model'
import { MaintenancePlan } from '@/models/maintenancePlan.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { WorkOrder } from '@/models/workOrder.model'
import { checkDuePlans, onTimeMaintenanceRate } from '@/services/maintenance.service'
import { notifyUser } from '@/services/notification.service'
import { accumulateRelayUsage } from '@/services/relayUsage.service'
import type { Role } from '@/types'
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
app.use('/maintenance', maintenanceRoutes)
app.use('/work-orders', workOrderRoutes)
app.use('/alerts', alertRoutes)
app.use(errorHandler)

useTestDb()
afterEach(() => MaintenancePlan.deleteMany({}))

const DAY = 86_400_000
const CHECKLIST = ['Bồn nước', 'Béc phun']

let seq = 0
async function account(role: Role) {
  seq++
  const user = await User.create({ email: `mt${seq}@test.vn`, password_hash: 'password123', full_name: `${role}${seq}`, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}
const JPEG = { filename: 'a.jpg', contentType: 'image/jpeg' }
// Báo xong bảo trì phải kèm ít nhất một ảnh bằng chứng
const doneWithPhoto = (token: string, path: string) =>
  request(app).post(`${path}/done`).set('Authorization', `Bearer ${token}`).attach('photos', Buffer.from('jpeg'), JPEG)

const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object = {}) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path: string) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

async function seed() {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const house2 = await House.create({ farm_id: ctx.farm._id, name: 'H2' })
  const [tech, other, expert] = [await account('FARM_TECHNICIAN'), await account('FARM_TECHNICIAN'), await account('DOMAIN_EXPERT')]
  ctx.farm.members.push(
    { user_id: tech.user._id, role: 'FARM_TECHNICIAN' } as never, { user_id: other.user._id, role: 'FARM_TECHNICIAN' } as never,
    { user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never,
  )
  await ctx.farm.save()
  house.technicians = [{ user_id: tech.user._id, primary: true }] as never
  await house.save()
  house2.technicians = [{ user_id: other.user._id, primary: true }] as never
  await house2.save()
  const owner$ = as(ctx.token)
  const plan = (body: object = {}) => owner$.post('/maintenance/plans', {
    house_id: String(house._id), equipment: 'PUMP', basis: 'RUN_HOURS', interval: 500,
    checklist_template: CHECKLIST, source: 'Khuyến cáo nhà sản xuất bơm', ...body,
  })
  const setPumpHours = (hours: number) =>
    SensorNode.updateOne({ _id: ctx.node._id }, { 'relay_usage.misting.since_service_hours': hours })
  return { ...ctx, house, house2, tech, other, expert, owner$, tech$: as(tech.token), other$: as(other.token), expert$: as(expert.token), plan, setPumpHours }
}

describe('kế hoạch bảo trì (OPS-FR-005)', () => {
  it('Farm Owner tạo kế hoạch SCHEDULED; khoảng ≤ 0 hoặc thiết bị không hợp cách tính → 422; thợ, chuyên gia tạo → 403', async () => {
    const { house, plan, tech$, expert$ } = await seed()
    const res = await plan().expect(201)
    expect(res.body.data).toMatchObject({ state: 'SCHEDULED', equipment: 'PUMP', interval: 500, checklist_template: CHECKLIST })

    await plan({ interval: 0 }).expect(422)
    await plan({ basis: 'CALENDAR' }).expect(422)
    await plan({ equipment: 'SENSOR', basis: 'RUN_HOURS' }).expect(422)
    await plan({ source: '' }).expect(422)
    const body = { house_id: String(house._id), equipment: 'PUMP', basis: 'RUN_HOURS', interval: 500, checklist_template: CHECKLIST, source: 'x' }
    await tech$.post('/maintenance/plans', body).expect(403)
    await expert$.post('/maintenance/plans', body).expect(403)
  })

  it('mỗi nhà một kế hoạch cho mỗi loại thiết bị: kế hoạch bơm thứ hai → 409; nhà khác, hay sau khi xoá thì được', async () => {
    const { house2, plan, owner$ } = await seed()
    const first = (await plan().expect(201)).body.data
    await plan({ basis: 'SWITCHES', interval: 100_000 }).expect(409)
    await plan({ house_id: String(house2._id) }).expect(201)
    await owner$.delete(`/maintenance/plans/${first._id}`).expect(200)
    await plan({ interval: 400 }).expect(201)
  })

  it('khoảng theo lịch lớn tới mức ngày đến hạn vượt giới hạn của Date → 422, không lỗi 500', async () => {
    const { plan, owner$ } = await seed()
    await plan({ equipment: 'NOZZLE', basis: 'CALENDAR', interval: 1_000_000_000 }).expect(422)
    const created = (await plan({ equipment: 'NOZZLE', basis: 'CALENDAR', interval: 30 }).expect(201)).body.data
    await owner$.put(`/maintenance/plans/${created._id}`, { interval: 1_000_000_000 }).expect(422)
    expect((await MaintenancePlan.findById(created._id).lean())!.interval).toBe(30)
  })

  it('kế hoạch theo lịch có điểm đến hạn đầu = hôm nay + khoảng ngày', async () => {
    const { plan } = await seed()
    const before = Date.now()
    const res = await plan({ equipment: 'NOZZLE', basis: 'CALENDAR', interval: 30 }).expect(201)
    const due = new Date(res.body.data.next_due_at).getTime()
    expect(due).toBeGreaterThanOrEqual(before + 30 * DAY)
    expect(due).toBeLessThan(Date.now() + 30 * DAY + 1000)
  })

  it('thợ chỉ đọc kế hoạch của nhà được giao; chuyên gia góp ý được và Farm Owner được báo', async () => {
    const { owner, house, plan, tech$, other$, expert$ } = await seed()
    const created = (await plan().expect(201)).body.data
    expect((await tech$.get('/maintenance/plans').expect(200)).body.data).toHaveLength(1)
    expect((await other$.get('/maintenance/plans').expect(200)).body.data).toHaveLength(0)
    // Hỏi đúng nhà không được giao: 403 như các route theo nhà khác, không phải danh sách rỗng
    await other$.get(`/maintenance/plans?houseId=${house._id}`).expect(403)
    await other$.get(`/maintenance/due?houseId=${house._id}`).expect(403)
    await tech$.put(`/maintenance/plans/${created._id}`, { interval: 400 }).expect(403)

    const commented = await expert$.post(`/maintenance/plans/${created._id}/comments`, { text: 'Bơm màng nên 400 giờ' }).expect(201)
    expect(commented.body.data.comments).toHaveLength(1)
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ body: 'Bơm màng nên 400 giờ' }))
  })
})

describe('đến hạn (OPS-FR-006, ALERT-FR-016)', () => {
  it('TC-F25-01 — bơm 500 giờ: 499 chưa gì; tới 500 thì 1 MAINTENANCE_DUE và 1 Work Order phòng ngừa cho thợ', async () => {
    const { node, plan, tech, setPumpHours } = await seed()
    const created = (await plan().expect(201)).body.data
    await setPumpHours(499)
    expect((await checkDuePlans()).opened).toBe(0)
    expect(await Alert.countDocuments({ type: 'MAINTENANCE_DUE' })).toBe(0)

    await setPumpHours(500)
    expect((await checkDuePlans()).opened).toBe(1)
    expect((await checkDuePlans()).opened).toBe(0)  // chạy lại không mở thêm
    const alerts = await Alert.find({ type: 'MAINTENANCE_DUE' }).lean()
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ severity: 'LOW', node_id: node._id, details: { plan_id: String(created._id), load: 'misting', counter: 500 } })
    expect(alerts[0].title).toBe(`Đến hạn bảo trì bơm phun sương · ${node.device_id}`)
    const orders = await WorkOrder.find().lean()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({
      kind: 'PREVENTIVE', origin: 'PLAN', node_id: node._id, alert_id: alerts[0]._id,
      assignee_id: tech.user._id, status: 'OPEN',
    })
    expect(String(orders[0].plan_id)).toBe(created._id)
    expect(orders[0].checklist.map(i => i.item)).toEqual(CHECKLIST)
    expect((await MaintenancePlan.findById(created._id).lean())!.state).toBe('DUE')
  })

  it('tải đã có kế hoạch không bị báo thêm theo mốc mặc định của relayUsage', async () => {
    const { node, plan, setPumpHours } = await seed()
    await plan().expect(201)
    await setPumpHours(600)  // vượt cả mốc mặc định 500 giờ của bơm
    const t0 = Date.now() - 60_000
    await Telemetry.create([
      { node_id: node._id, zone_id: node.zone_id, timestamp: new Date(t0), misting_on: true, ventilation_on: false },
      { node_id: node._id, zone_id: node.zone_id, timestamp: new Date(t0 + 10_000), misting_on: true, ventilation_on: false },
    ])
    await accumulateRelayUsage()
    expect(await Alert.countDocuments({ type: 'MAINTENANCE_DUE' })).toBe(0)
    await checkDuePlans()
    expect(await Alert.countDocuments({ type: 'MAINTENANCE_DUE', 'details.plan_id': { $exists: true } })).toBe(1)
  })

  it('quạt chưa có kế hoạch vượt mốc mặc định khi cảnh báo của kế hoạch bơm đang mở: cảnh báo riêng, không gộp', async () => {
    const { node, plan, setPumpHours } = await seed()
    const created = (await plan().expect(201)).body.data
    await setPumpHours(500)
    await checkDuePlans()
    await SensorNode.updateOne({ _id: node._id }, { 'relay_usage.ventilation.since_service_hours': 2001 })
    const t0 = Date.now() - 60_000
    await Telemetry.create([
      { node_id: node._id, zone_id: node.zone_id, timestamp: new Date(t0), misting_on: false, ventilation_on: true },
      { node_id: node._id, zone_id: node.zone_id, timestamp: new Date(t0 + 10_000), misting_on: false, ventilation_on: true },
    ])
    await accumulateRelayUsage()
    const alerts = await Alert.find({ type: 'MAINTENANCE_DUE' }).lean()
    expect(alerts).toHaveLength(2)
    const planAlert = alerts.find(a => a.details?.plan_id)!
    const fanAlert = alerts.find(a => !a.details?.plan_id)!
    expect(planAlert.details).toMatchObject({ plan_id: created._id, load: 'misting' })
    expect((fanAlert.metadata?.loads as Array<{ relay: string }>).map(l => l.relay)).toEqual(['ventilation'])
  })

  it('kế hoạch theo lịch đến hạn hôm nay (dù điểm đến hạn sau 07:00) thì báo ở lượt 07:00 hôm đó', async () => {
    const { plan } = await seed()
    const created = (await plan({ equipment: 'NOZZLE', basis: 'CALENDAR', interval: 30 }).expect(201)).body.data
    // Điểm đến hạn 10:00 giờ VN ngày 01/12
    await MaintenancePlan.updateOne({ _id: created._id }, { next_due_at: new Date('2026-12-01T03:00:00Z') })
    expect((await checkDuePlans(new Date('2026-11-30T00:00:00Z'), { calendar: true })).opened).toBe(0)
    expect((await checkDuePlans(new Date('2026-12-01T00:00:00Z'), { calendar: true })).opened).toBe(1)
  })

  it('kế hoạch theo lịch chỉ đến hạn ở lượt 07:00 sau điểm đến hạn; cảnh báo của nhà', async () => {
    const { house, plan } = await seed()
    await plan({ equipment: 'SENSOR', basis: 'CALENDAR', interval: 30 }).expect(201)
    expect((await checkDuePlans(new Date(Date.now() + 31 * DAY))).opened).toBe(0)  // lượt mỗi giờ không xét lịch
    expect((await checkDuePlans(new Date(Date.now() + 29 * DAY), { calendar: true })).opened).toBe(0)
    expect((await checkDuePlans(new Date(Date.now() + 31 * DAY), { calendar: true })).opened).toBe(1)
    const alert = (await Alert.findOne({ type: 'MAINTENANCE_DUE' }).lean())!
    expect(alert).toMatchObject({ house_id: house._id })
    expect(alert.title).toMatch(/^Đến hạn .+ · /)
    expect(alert.title).not.toContain('—')
  })

  it('TC-F25-03 — còn đến hạn 7 ngày thì OVERDUE và báo Farm Owner đúng 1 lần', async () => {
    const { owner, plan, setPumpHours } = await seed()
    const created = (await plan().expect(201)).body.data
    await setPumpHours(500)
    await checkDuePlans()
    await MaintenancePlan.updateOne({ _id: created._id }, { due_since: new Date(Date.now() - 8 * DAY) })
    ;(notifyUser as jest.Mock).mockClear()
    expect((await checkDuePlans()).overdue).toBe(1)
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({ title: expect.stringContaining('Quá hạn') }))
    expect((await MaintenancePlan.findById(created._id).lean())!.state).toBe('OVERDUE')
    expect((await checkDuePlans()).overdue).toBe(0)
  })

  it('xoá kế hoạch → RETIRED, không đến hạn nữa, mặc định không hiện trong danh sách', async () => {
    const { plan, owner$, setPumpHours } = await seed()
    const created = (await plan().expect(201)).body.data
    expect((await owner$.delete(`/maintenance/plans/${created._id}`).expect(200)).body.data.state).toBe('RETIRED')
    await setPumpHours(900)
    expect((await checkDuePlans()).opened).toBe(0)
    expect((await owner$.get('/maintenance/plans').expect(200)).body.data).toHaveLength(0)
    expect((await owner$.get('/maintenance/plans?state=RETIRED').expect(200)).body.data).toHaveLength(1)
    await owner$.put(`/maintenance/plans/${created._id}`, { interval: 100 }).expect(409)
  })

  it('xoá kế hoạch đang đến hạn: Work Order phòng ngừa bị huỷ và cảnh báo của kế hoạch đóng', async () => {
    const { plan, owner$, setPumpHours } = await seed()
    const created = (await plan().expect(201)).body.data
    await setPumpHours(520)
    await checkDuePlans()
    const wo = (await WorkOrder.findOne().lean())!
    await owner$.delete(`/maintenance/plans/${created._id}`).expect(200)
    expect((await WorkOrder.findById(wo._id).lean())!).toMatchObject({ status: 'CANCELLED', is_open: false })
    expect((await Alert.findById(wo.alert_id).lean())!.status).toBe('RESOLVED')
  })
})

describe('Work Order phòng ngừa và ghi bảo trì (OPS-FR-007, 008, BR-41)', () => {
  async function due() {
    const ctx = await seed()
    const created = (await ctx.plan().expect(201)).body.data
    await ctx.setPumpHours(520)
    await checkDuePlans()
    const wo = (await WorkOrder.findOne())!
    const path = `/work-orders/${wo._id}`
    await ctx.tech$.post(`${path}/start`).expect(200)
    return { ...ctx, created, wo, path }
  }

  it('TC-F25-02 — thiếu checklist báo xong → 422; đủ checklist thì chờ duyệt; Farm Owner duyệt: bộ đếm 0, cảnh báo đóng, kế hoạch SCHEDULED', async () => {
    const { owner, node, tech, tech$, owner$, path, created, wo } = await due()
    await tech$.post(`${path}/done`, {}).expect(422)
    await tech$.put(`${path}/checklist`, { item_index: 5, result: 'OK' }).expect(400)
    await tech$.put(`${path}/checklist`, { item_index: 0, result: 'OK' }).expect(200)
    await tech$.put(`${path}/checklist`, { item_index: 1, result: 'OK', note: 'Đã thông béc' }).expect(200)
    // Đủ checklist mà chưa có ảnh nào: vẫn 422
    const noPhoto = await tech$.post(`${path}/done`, { work_note: 'Thay màng bơm' }).expect(422)
    expect(noPhoto.body.error.message).toContain('ít nhất một ảnh')
    const done = await doneWithPhoto(tech.token, path).field('work_note', 'Thay màng bơm').expect(200)
    expect(done.body.data.status).toBe('AWAITING_APPROVAL')  // không qua kiểm dữ liệu phục hồi
    expect(done.body.data.checklist.map((c: { by_name: string | null }) => c.by_name)).toEqual([tech.user.full_name, tech.user.full_name])

    // Chỉ duyệt Work Order mới là ghi bảo trì
    const ownerAck = await owner$.put(`/alerts/${wo.alert_id}/acknowledge`, { note: 'đã thấy' }).expect(200)
    expect(ownerAck.body.data.status).toBe('ACKNOWLEDGED')
    expect((await SensorNode.findById(node._id).lean())!.relay_usage.misting.since_service_hours).toBe(520)

    const approved = await owner$.post(`${path}/approve`).expect(200)
    expect(approved.body.data).toMatchObject({ status: 'CLOSED', result: 'DONE' })
    expect((await SensorNode.findById(node._id).lean())!.relay_usage.misting.since_service_hours).toBe(0)
    expect((await Alert.findById(wo.alert_id).lean())!.status).toBe('RESOLVED')
    const plan = (await MaintenancePlan.findById(created._id).lean())!
    expect(plan.state).toBe('SCHEDULED')
    expect(plan.records).toHaveLength(1)
    expect(plan.records[0]).toMatchObject({ kind: 'MAINTENANCE', by: owner._id, node_id: node._id })
  })

  it('kế hoạch theo lịch: duyệt tính hạn kế = lúc ghi + khoảng; hiệu chuẩn ghi là CALIBRATION', async () => {
    const { plan, tech, tech$, owner$ } = await seed()
    const created = (await plan({ equipment: 'CALIBRATION', basis: 'CALENDAR', interval: 90 }).expect(201)).body.data
    await checkDuePlans(new Date(Date.now() + 91 * DAY), { calendar: true })
    const wo = (await WorkOrder.findOne())!
    await tech$.post(`/work-orders/${wo._id}/start`).expect(200)
    for (const i of [0, 1]) await tech$.put(`/work-orders/${wo._id}/checklist`, { item_index: i, result: 'OK' }).expect(200)
    await doneWithPhoto(tech.token, `/work-orders/${wo._id}`).expect(200)
    const before = Date.now()
    await owner$.post(`/work-orders/${wo._id}/approve`).expect(200)
    const after = (await MaintenancePlan.findById(created._id).lean())!
    expect(after.records[0].kind).toBe('CALIBRATION')
    expect(after.next_due_at!.getTime()).toBeGreaterThanOrEqual(before + 90 * DAY)
  })

  it('TC-F25-03 — mục checklist DEFECT mở đúng 1 Work Order sửa chữa; Work Order sửa chữa không có checklist', async () => {
    const { tech$, other$, path } = await due()
    await other$.put(`${path}/checklist`, { item_index: 0, result: 'DEFECT' }).expect(403)
    const res = await tech$.put(`${path}/checklist`, { item_index: 0, result: 'DEFECT', note: 'Bồn rò nước' }).expect(200)
    expect(res.body.data.checklist[0]).toMatchObject({ result: 'DEFECT', repair_work_order_id: expect.any(String) })
    await tech$.put(`${path}/checklist`, { item_index: 0, result: 'DEFECT' }).expect(200)
    const repairs = await WorkOrder.find({ origin: 'CHECKLIST' }).lean()
    expect(repairs).toHaveLength(1)
    expect(repairs[0]).toMatchObject({ kind: 'REPAIR', title: 'Sửa chữa: Bồn nước', description: 'Bồn rò nước' })
    await tech$.put(`/work-orders/${repairs[0]._id}/checklist`, { item_index: 0, result: 'OK' }).expect(409)

    // Bấm đúp: vẫn đúng một Work Order sửa chữa
    const both = await Promise.all([0, 1].map(() => tech$.put(`${path}/checklist`, { item_index: 1, result: 'DEFECT' })))
    expect(both.map(r => r.status)).toEqual([200, 200])
    const second = await WorkOrder.find({ origin: 'CHECKLIST', title: 'Sửa chữa: Béc phun' }).lean()
    expect(second).toHaveLength(1)
    expect(String((await WorkOrder.findOne({ kind: 'PREVENTIVE' }).lean())!.checklist[1].repair_work_order_id)).toBe(String(second[0]._id))

    // Ghi lại là Đạt với ghi chú trống: ghi chú "Bồn rò nước" cũ bị bỏ
    const again = await tech$.put(`${path}/checklist`, { item_index: 0, result: 'OK' }).expect(200)
    expect(again.body.data.checklist[0].result).toBe('OK')
    expect(again.body.data.checklist[0].note).toBeUndefined()
  })

  it('Farm Owner không huỷ được Work Order phòng ngừa (409): kế hoạch chỉ rời DUE khi ghi bảo trì hoặc bị xoá', async () => {
    const { owner$, path } = await due()
    const res = await owner$.post(`${path}/cancel`, { reason: 'Chưa cần bảo trì' }).expect(409)
    expect(res.body.error.message).toContain('xoá kế hoạch')
    expect((await WorkOrder.findOne({ kind: 'PREVENTIVE' }).lean())!.status).toBe('IN_PROGRESS')
  })

  it('Work Order phòng ngừa không bị leo thang 15 phút như Work Order sửa chữa', async () => {
    const ctx = await seed()
    await ctx.plan().expect(201)
    await ctx.setPumpHours(600)
    await checkDuePlans()
    await WorkOrder.updateMany({}, { opened_at: new Date(Date.now() - 60 * 60_000) })
    const { verifyWorkOrders } = await import('@/services/workOrder.service')
    expect((await verifyWorkOrders()).escalated).toBe(0)
  })
})

describe('danh sách đến hạn và tỷ lệ bảo trì đúng hạn (OPS-FR-006, BR-40)', () => {
  it('GET /maintenance/due trả kế hoạch DUE kèm Work Order đang mở', async () => {
    const { plan, owner$, setPumpHours } = await seed()
    await plan().expect(201)
    await setPumpHours(510)
    await checkDuePlans()
    const res = await owner$.get('/maintenance/due').expect(200)
    expect(res.body.meta).toEqual({ total: 1, page: 1, limit: 100 })
    const due = res.body.data
    expect(due).toHaveLength(1)
    await owner$.get('/maintenance/due?limit=500').expect(422)
    expect(due[0]).toMatchObject({ state: 'DUE', open_work_orders: [String((await WorkOrder.findOne().lean())!._id)] })
  })

  it('đúng hạn = đóng trong 7 ngày từ lúc mở; null khi không có Work Order phòng ngừa', async () => {
    const { farm, house } = await seed()
    const t0 = new Date('2026-11-01T00:00:00Z')
    const base = { farm_id: farm._id, house_id: house._id, kind: 'PREVENTIVE', origin: 'PLAN', title: 'x', opened_at: t0 }
    await WorkOrder.create([
      { ...base, status: 'CLOSED', is_open: false, closed_at: new Date(t0.getTime() + 3 * DAY) },
      { ...base, status: 'CLOSED', is_open: false, closed_at: new Date(t0.getTime() + 9 * DAY) },
      { ...base, status: 'OPEN' },
      { ...base, status: 'CANCELLED', is_open: false, closed_at: new Date(t0.getTime() + DAY) },
      { ...base, kind: 'REPAIR', origin: 'MANUAL', status: 'CLOSED', is_open: false, closed_at: t0 },
    ])
    const range: [Date, Date] = [new Date(t0.getTime() - DAY), new Date(t0.getTime() + DAY)]
    // Đóng trễ và còn mở quá 7 ngày là trễ; bị huỷ thì không tính
    expect(await onTimeMaintenanceRate([house._id], ...range, new Date('2026-11-20T00:00:00Z'))).toBe(33)
    // Hai ngày sau khi mở: cái còn mở chưa trễ, không vào mẫu số
    expect(await onTimeMaintenanceRate([house._id], ...range, new Date(t0.getTime() + 2 * DAY))).toBe(50)
    expect(await onTimeMaintenanceRate([house._id], new Date('2026-01-01'), new Date('2026-02-01'))).toBeNull()
  })
})

describe('ảnh bằng chứng khi báo xong bảo trì (OPS-FR-008)', () => {
  async function started() {
    const ctx = await seed()
    await ctx.plan().expect(201)
    await ctx.setPumpHours(520)
    await checkDuePlans()
    const wo = (await WorkOrder.findOne())!
    const path = `/work-orders/${wo._id}`
    await ctx.tech$.post(`${path}/start`).expect(200)
    for (const i of [0, 1]) await ctx.tech$.put(`${path}/checklist`, { item_index: i, result: 'OK' }).expect(200)
    return { ...ctx, path }
  }

  it('không ảnh nào thì 422 và phiếu vẫn IN_PROGRESS; ảnh của phiếu hoặc của một mục checklist đều được tính', async () => {
    const { tech, tech$, path } = await started()
    await tech$.post(`${path}/done`, {}).expect(422)
    expect((await WorkOrder.findOne().lean())!.status).toBe('IN_PROGRESS')

    // Ảnh gắn vào một mục checklist cũng là bằng chứng
    await request(app).put(`${path}/checklist`).set('Authorization', `Bearer ${tech.token}`)
      .field('item_index', '0').field('result', 'OK').attach('photo', Buffer.from('jpeg'), JPEG).expect(200)
    await tech$.post(`${path}/done`, {}).expect(200)
  })

  it('phiếu sửa chữa vẫn báo xong được mà không cần ảnh', async () => {
    const ctx = await seedOwnerFarm()
    const house = (await House.findOne({ farm_id: ctx.farm._id }))!
    const tech = await account('FARM_TECHNICIAN')
    ctx.farm.members.push({ user_id: tech.user._id, role: 'FARM_TECHNICIAN' } as never)
    await ctx.farm.save()
    house.technicians = [{ user_id: tech.user._id, primary: true }] as never
    await house.save()
    const created = await as(ctx.token).post('/work-orders', { house_id: String(house._id), title: 'Kiểm tra và sửa béc phun' }).expect(201)
    const path = `/work-orders/${created.body.data._id}`
    await as(tech.token).post(`${path}/start`).expect(200)
    await as(tech.token).post(`${path}/done`, {}).expect(200)
  })
})

describe('nhắc hằng ngày khi bảo trì đến hạn hoặc quá hạn (OPS-FR-006)', () => {
  // 08:00 giờ VN; các lượt 07:00 sau đó cách nhau đúng ngày
  const T0 = new Date('2026-12-01T01:00:00Z')
  const at = (days: number, hour = 0) => new Date(T0.getTime() + days * DAY + hour * 3600_000 - 1 * 3600_000)
  const reminders = () => (notifyUser as jest.Mock).mock.calls
    .filter(([, message]) => String(message.title).startsWith('Nhắc bảo trì'))
    .map(([userId]) => String(userId))

  async function dueAt() {
    const ctx = await seed()
    await ctx.plan().expect(201)
    await ctx.setPumpHours(520)
    await checkDuePlans(T0)
    ;(notifyUser as jest.Mock).mockClear()
    return ctx
  }

  it('ngày đến hạn chưa nhắc lại; từ hôm sau nhắc kỹ thuật viên giữ phiếu mỗi ngày một lần', async () => {
    const { tech } = await dueAt()
    await checkDuePlans(at(0, 1), { calendar: true })
    expect(reminders()).toEqual([])

    await checkDuePlans(at(1), { calendar: true })
    expect(reminders()).toEqual([String(tech.user._id)])
    // Chạy lại trong cùng ngày không nhắc lần nữa
    await checkDuePlans(at(1, 1), { calendar: true })
    expect(reminders()).toHaveLength(1)

    await checkDuePlans(at(2), { calendar: true })
    expect(reminders()).toHaveLength(2)
  })

  it('quá hạn: Farm Owner được báo ngay một lần, rồi nhắc mỗi ngày cùng với kỹ thuật viên', async () => {
    const { tech, owner } = await dueAt()
    await checkDuePlans(at(7, 2), { calendar: true })
    expect(String((await MaintenancePlan.findOne().lean())!.state)).toBe('OVERDUE')
    expect((notifyUser as jest.Mock).mock.calls.some(([id, message]) => String(id) === String(owner._id) && String(message.title).startsWith('Quá hạn bảo trì'))).toBe(true)
    ;(notifyUser as jest.Mock).mockClear()

    await checkDuePlans(at(8), { calendar: true })
    expect(reminders().sort()).toEqual([String(owner._id), String(tech.user._id)].sort())
  })

  it('ghi bảo trì xong thì hết nhắc', async () => {
    const { tech, tech$, owner$ } = await dueAt()
    const wo = (await WorkOrder.findOne())!
    const path = `/work-orders/${wo._id}`
    await tech$.post(`${path}/start`).expect(200)
    for (const i of [0, 1]) await tech$.put(`${path}/checklist`, { item_index: i, result: 'OK' }).expect(200)
    await doneWithPhoto(tech.token, path).expect(200)
    await owner$.post(`${path}/approve`).expect(200)
    ;(notifyUser as jest.Mock).mockClear()

    await checkDuePlans(at(3), { calendar: true })
    expect(reminders()).toEqual([])
  })
})
