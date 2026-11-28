import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
import workOrderRoutes from '@/routes/workOrders.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { WorkOrder } from '@/models/workOrder.model'
import { createAlert } from '@/services/alert.service'
import { decommissionDevice, reassignZone } from '@/services/device.service'
import { notifyUser } from '@/services/notification.service'
import { openWorkOrderForAlert, verifyWorkOrders } from '@/services/workOrder.service'
import type { AlertType, CurrentUser, Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitHouseDeviceStatusChange: jest.fn(), emitRelayUpdate: jest.fn(),
}))
jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
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
  const user = await User.create({ email: `fu${seq}@test.vn`, password_hash: 'password123', full_name: `${role} ${seq}`, role })
  const token = jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  const current: CurrentUser = { _id: String(user._id), email: user.email, role }
  return { user, token, current }
}
const as = (token: string) => ({
  post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object = {}) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
})

// Nhà H có thợ chính T và thợ phụ T2, farm có 1 chuyên gia
async function seed() {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const [tech, tech2, expert] = [await account('FARM_TECHNICIAN'), await account('FARM_TECHNICIAN'), await account('DOMAIN_EXPERT')]
  for (const t of [tech, tech2]) ctx.farm.members.push({ user_id: t.user._id, role: 'FARM_TECHNICIAN' } as never)
  ctx.farm.members.push({ user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never)
  await ctx.farm.save()
  house.technicians = [{ user_id: tech.user._id, primary: true }, { user_id: tech2.user._id, primary: false }] as never
  await house.save()
  const raise = (type: AlertType) => createAlert({
    farmId: String(ctx.farm._id), zoneId: String(ctx.zone._id), nodeId: String(ctx.node._id),
    type, title: `${type} tại Z`, message: 'chi tiết',
  })
  return { ...ctx, house, tech, tech2, expert, raise, owner$: as(ctx.token), tech$: as(tech.token), tech2$: as(tech2.token), expert$: as(expert.token) }
}

const later = (min: number) => new Date(Date.now() + min * 60_000)
const notifiedIds = () => (notifyUser as jest.Mock).mock.calls.map(([id]) => String(id))
const notifiedTitles = (userId: unknown) => (notifyUser as jest.Mock).mock.calls
  .filter(([id]) => String(id) === String(userId)).map(([, message]) => (message as { title: string }).title)
const workOrder = async () => (await WorkOrder.findOne({ kind: 'REPAIR' }).lean())!

describe('thiết bị rời chỗ: phiếu không tự đóng như đã phục hồi', () => {
  it('gỡ thiết bị khi phiếu chưa ai bắt đầu: phiếu được đánh dấu, cảnh báo đóng nhưng phiếu không đóng "tự phục hồi"', async () => {
    const { owner, user, tech, node, raise } = await seed()
    const alert = (await raise('SENSOR_FAULT'))!
    ;(notifyUser as jest.Mock).mockClear()

    await decommissionDevice('sensor', String(node._id), user, 'Cảm biến cháy', { force: true })

    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
    const wo = await workOrder()
    expect(wo).toMatchObject({ status: 'OPEN', is_open: true, device_left: { kind: 'REMOVED' } })
    expect(wo.history.at(-1)!.note).toContain('đã được gỡ')
    expect(wo.history.at(-1)!.note).toContain('Cảm biến cháy')
    // Người gỡ không tự nhận thông báo; thợ giữ phiếu được báo
    expect(notifiedTitles(tech.user._id)).toContainEqual(expect.stringContaining('đã bị gỡ'))
    expect(notifiedIds()).not.toContain(String(owner._id))

    const result = await verifyWorkOrders(later(30))
    expect(result.selfRecovered).toBe(0)
    expect((await workOrder()).status).toBe('OPEN')
  })

  it('gỡ thiết bị khi phiếu đang chờ kiểm: chuyển chờ duyệt ngay với ghi chú kiểm tại nhà yến, không ghi "dữ liệu giữ phục hồi"', async () => {
    const { owner, user, node, raise, tech$ } = await seed()
    await raise('SENSOR_FAULT')
    const { _id } = await workOrder()
    await tech$.post(`/work-orders/${_id}/start`).expect(200)
    await tech$.post(`/work-orders/${_id}/done`, { cause: 'SENSOR' }).expect(200)

    await decommissionDevice('sensor', String(node._id), user, 'Thay cả bo', { force: true })
    ;(notifyUser as jest.Mock).mockClear()
    expect((await verifyWorkOrders()).verified).toBe(1)

    const wo = await workOrder()
    expect(wo.status).toBe('AWAITING_APPROVAL')
    expect(wo.history.at(-1)!.note).toContain('Thiết bị đã rời chỗ')
    expect(wo.history.map(h => h.note ?? '').join(' ')).not.toContain('giữ phục hồi')
    expect(notifyUser).toHaveBeenCalledWith(String(owner._id), expect.objectContaining({
      body: expect.stringContaining('Chưa có dữ liệu để kiểm phục hồi'),
    }))
  })

  it('thay thiết bị: phiếu ghi thiết bị mới, đánh dấu REPLACED', async () => {
    const { user, node, zone, raise } = await seed()
    await raise('RS485_BUS_FAILURE')
    const replacement = await SensorNode.create({ device_id: 'ESP-NEW', zone_id: zone._id, status: 'PENDING' })

    await decommissionDevice('sensor', String(node._id), user, 'Bus hỏng', { replacement, force: true })

    const wo = await workOrder()
    expect(wo.device_left?.kind).toBe('REPLACED')
    expect(wo.history.at(-1)!.note).toContain('ESP-NEW')
    expect((await SensorNode.findById(node._id).lean())!.replaced_by).toEqual(replacement._id)
    expect((await verifyWorkOrders(later(30))).selfRecovered).toBe(0)
  })

  it('dời thiết bị sang Zone khác: đánh dấu MOVED, ghi cả hai Zone, phiếu không tự đóng', async () => {
    const { user, node, house, farm, raise } = await seed()
    await raise('SENSOR_FAULT')
    const dest = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Z2' })

    await reassignZone(String(node._id), user, { newZoneId: String(dest._id) })

    const wo = await workOrder()
    expect(wo.device_left?.kind).toBe('MOVED')
    expect(wo.history.at(-1)!.note).toContain('"Z"')
    expect(wo.history.at(-1)!.note).toContain('"Z2"')
    expect((await verifyWorkOrders(later(30))).selfRecovered).toBe(0)
    expect((await workOrder()).status).toBe('OPEN')
  })

  it('phiếu đã đóng và phiếu phòng ngừa của thiết bị không bị đánh dấu', async () => {
    const { user, node, farm, house, raise } = await seed()
    await raise('SPEAKER_FAILURE')
    const closed = await workOrder()
    await WorkOrder.updateOne({ _id: closed._id }, { status: 'CLOSED', is_open: false })
    const preventive = await WorkOrder.create({
      farm_id: farm._id, house_id: house._id, node_id: node._id, kind: 'PREVENTIVE', origin: 'PLAN', title: 'Bảo trì bơm',
      history: [{ to: 'OPEN', at: new Date() }],
    })

    await decommissionDevice('sensor', String(node._id), user, 'Thu hồi', { force: true })

    expect((await WorkOrder.findById(closed._id).lean())!.device_left).toBeUndefined()
    expect((await WorkOrder.findById(preventive._id).lean())!.device_left).toBeUndefined()
  })

  it('không có thiết bị rời chỗ thì cảnh báo tự phục hồi vẫn đóng phiếu "self-recovered" như cũ', async () => {
    const { raise } = await seed()
    const alert = (await raise('SENSOR_FAULT'))!
    await Alert.updateOne({ _id: alert._id }, { status: 'RESOLVED', resolved_at: new Date() })
    expect((await verifyWorkOrders(later(11))).selfRecovered).toBe(1)
  })
})

describe('cảnh báo bị bác bỏ: phiếu của nó không chạy tiếp âm thầm', () => {
  async function expertVisit() {
    const ctx = await seed()
    const alert = (await ctx.raise('NOISE_ANOMALY'))!
    await ctx.expert$.put(`/alerts/${alert._id}/verdict`, { result: 'CONFIRMED', needs_visit: true }).expect(200)
    const wo = await workOrder()
    expect(wo.origin).toBe('EXPERT')
    ;(notifyUser as jest.Mock).mockClear()
    return { ...ctx, alert, wo }
  }

  it('phiếu do "cần tới nhà" mở, chưa làm xong → huỷ kèm lý do bác bỏ, thợ được báo, có nhật ký', async () => {
    const { alert, tech, expert, expert$ } = await expertVisit()
    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED', note: 'Tiếng mưa trên mái' }).expect(200)

    const wo = await workOrder()
    expect(wo).toMatchObject({ status: 'CANCELLED', is_open: false, cancel_reason: 'Cảnh báo đã bị bác bỏ: Tiếng mưa trên mái' })
    expect(wo.history.at(-1)).toMatchObject({ from: 'OPEN', to: 'CANCELLED', by: expert.user._id })
    expect(notifiedTitles(tech.user._id)).toContainEqual(expect.stringContaining('Phiếu công việc đã huỷ'))
    expect(await AuditLog.exists({ action: 'WORK_ORDER_CANCELLED', target_id: String(wo._id) })).toBeTruthy()
    expect((await Alert.findById(alert._id).lean())!.status).toBe('DISMISSED')
  })

  it('phiếu đang làm cũng huỷ; xác nhận lại kèm cần tới nhà thì mở phiếu mới', async () => {
    const { alert, wo, tech$, expert$ } = await expertVisit()
    await tech$.post(`/work-orders/${wo._id}/start`).expect(200)
    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED', note: 'Nhầm' }).expect(200)
    expect((await WorkOrder.findById(wo._id).lean())!.status).toBe('CANCELLED')

    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'CONFIRMED', needs_visit: true }).expect(200)
    const open = await WorkOrder.find({ alert_id: alert._id, is_open: true }).lean()
    expect(open).toHaveLength(1)
    expect(String(open[0]._id)).not.toBe(String(wo._id))
  })

  it('phiếu do thợ thấy hỏng tại chỗ mở thì vẫn mở: ghi diễn biến, báo thợ và chủ nhà yến', async () => {
    const { owner, tech, expert$, raise } = await seed()
    const alert = (await raise('SENSOR_ANOMALY'))!
    await openWorkOrderForAlert(alert, 'ONSITE_CHECK')
    ;(notifyUser as jest.Mock).mockClear()

    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED', note: 'Số đo vẫn hợp lý' }).expect(200)

    const wo = await workOrder()
    expect(wo).toMatchObject({ status: 'OPEN', is_open: true, origin: 'ONSITE_CHECK' })
    expect(wo.history.at(-1)!.note).toBe('Cảnh báo của phiếu đã bị bác bỏ: Số đo vẫn hợp lý')
    for (const id of [tech.user._id, owner._id]) {
      expect(notifiedTitles(id)).toContainEqual(expect.stringContaining('Cảnh báo của phiếu công việc đã bị bác bỏ'))
    }
  })

  it('phiếu chủ nhà mở tay trên cảnh báo cũng chỉ ghi chú', async () => {
    const { house, owner$, expert$, raise } = await seed()
    const alert = (await raise('FORECAST_BREACH'))!
    await owner$.post('/work-orders', { house_id: String(house._id), title: 'Kiểm tra quạt', alert_id: String(alert._id) }).expect(201)

    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED', note: 'Dự báo lệch' }).expect(200)

    expect(await workOrder()).toMatchObject({ status: 'OPEN', origin: 'MANUAL' })
  })

  it('phiếu "cần tới nhà" đã làm xong, đang chờ duyệt thì không huỷ: chủ nhà yến vẫn duyệt được', async () => {
    const { alert, wo, owner$, expert$ } = await expertVisit()
    await WorkOrder.updateOne({ _id: wo._id }, { status: 'AWAITING_APPROVAL' })
    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED', note: 'Nhầm' }).expect(200)
    expect((await workOrder()).status).toBe('AWAITING_APPROVAL')
    await owner$.post(`/work-orders/${wo._id}/approve`).expect(200)
  })

  it('bác bỏ cảnh báo không có phiếu nào vẫn trả 200', async () => {
    const { expert$, raise } = await seed()
    const alert = (await raise('FORECAST_BREACH'))!
    await expert$.put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED', note: 'Nhầm' }).expect(200)
    expect(await WorkOrder.countDocuments()).toBe(0)
  })
})

describe('duyệt phiếu: ghi chú đóng cảnh báo nói đúng việc đã duyệt', () => {
  it('cảnh báo chưa có ghi chú: ghi "chủ nhà yến đã duyệt phiếu công việc"', async () => {
    const { owner$, tech$, raise } = await seed()
    const alert = (await raise('ACTUATOR_FAULT'))!
    const { _id } = await workOrder()
    await tech$.post(`/work-orders/${_id}/start`).expect(200)
    await tech$.post(`/work-orders/${_id}/done`, { cause: 'PUMP' }).expect(200)
    await verifyWorkOrders()
    await owner$.post(`/work-orders/${_id}/approve`).expect(200)

    expect((await Alert.findById(alert._id).lean())!).toMatchObject({
      status: 'RESOLVED', acknowledgement_note: 'Đã sửa, chủ nhà yến đã duyệt phiếu công việc',
    })
  })

  it('ghi chú người xác nhận đã viết thì giữ nguyên', async () => {
    const { owner$, tech$, raise } = await seed()
    const alert = (await raise('ACTUATOR_FAULT'))!
    await tech$.put(`/alerts/${alert._id}/acknowledge`, { note: 'Rơ le bơm dính' }).expect(200)
    const { _id } = await workOrder()
    await tech$.post(`/work-orders/${_id}/start`).expect(200)
    await tech$.post(`/work-orders/${_id}/done`, { cause: 'PUMP' }).expect(200)
    await verifyWorkOrders()
    await owner$.post(`/work-orders/${_id}/approve`).expect(200)

    expect((await Alert.findById(alert._id).lean())!).toMatchObject({ status: 'RESOLVED', acknowledgement_note: 'Rơ le bơm dính' })
  })

  it('phiếu phòng ngừa: ghi "chủ nhà yến đã duyệt phiếu bảo trì"', async () => {
    const { owner$, farm, house, raise } = await seed()
    const alert = (await raise('MAINTENANCE_DUE'))!
    const wo = await WorkOrder.create({
      farm_id: farm._id, house_id: house._id, alert_id: alert._id, kind: 'PREVENTIVE', origin: 'PLAN', title: 'Bảo trì bơm',
      status: 'AWAITING_APPROVAL', history: [{ to: 'AWAITING_APPROVAL', at: new Date() }],
    })
    await owner$.post(`/work-orders/${wo._id}/approve`).expect(200)
    expect((await Alert.findById(alert._id).lean())!.acknowledgement_note).toBe('Đã bảo trì, chủ nhà yến đã duyệt phiếu bảo trì')
  })
})

describe('kỹ thuật viên làm phiếu thì thành người nhận phiếu', () => {
  it('bắt đầu phiếu đang giao cho thợ khác: nhận làm thay, người cũ được báo, có nhật ký giao lại', async () => {
    const { tech, tech2, tech2$, raise } = await seed()
    await raise('SPEAKER_FAILURE')
    const before = await workOrder()
    expect(String(before.assignee_id)).toBe(String(tech.user._id))
    ;(notifyUser as jest.Mock).mockClear()

    const res = await tech2$.post(`/work-orders/${before._id}/start`).expect(200)

    expect(res.body.data.assignee._id).toBe(String(tech2.user._id))
    const wo = await workOrder()
    expect(wo.assigned_at!.getTime()).toBeGreaterThan(before.assigned_at!.getTime() - 1)
    expect(wo.history.at(-1)).toMatchObject({ from: 'OPEN', to: 'IN_PROGRESS', note: `Nhận làm thay ${tech.user.full_name}` })
    expect(notifiedTitles(tech.user._id)).toContainEqual(expect.stringContaining('đã có người nhận làm'))
    const audit = await AuditLog.findOne({ action: 'WORK_ORDER_REASSIGNED', target_id: String(wo._id) }).lean()
    expect(audit?.metadata).toMatchObject({ from: String(tech.user._id), to: String(tech2.user._id), taken_over: true })
  })

  it('phiếu chưa giao ai (nhà được giao thợ sau): thợ bắt đầu thì nhận phiếu, không ai bị báo "đã có người nhận"', async () => {
    const { house, tech, tech$, raise } = await seed()
    await House.updateOne({ _id: house._id }, { technicians: [] })
    await raise('SPEAKER_FAILURE')
    expect((await workOrder()).assignee_id).toBeUndefined()
    await House.updateOne({ _id: house._id }, { technicians: [{ user_id: tech.user._id, primary: true }] })
    ;(notifyUser as jest.Mock).mockClear()

    await tech$.post(`/work-orders/${(await workOrder())._id}/start`).expect(200)

    const wo = await workOrder()
    expect(String(wo.assignee_id)).toBe(String(tech.user._id))
    expect(wo.history.at(-1)!.note).toBe('Nhận phiếu chưa giao ai')
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('thợ được giao tự bắt đầu: không ghi nhận thay, không nhật ký giao lại', async () => {
    const { tech, tech$, raise } = await seed()
    await raise('SPEAKER_FAILURE')
    await tech$.post(`/work-orders/${(await workOrder())._id}/start`).expect(200)
    const wo = await workOrder()
    expect(String(wo.assignee_id)).toBe(String(tech.user._id))
    expect(wo.history.at(-1)!.note).toBeUndefined()
    expect(await AuditLog.exists({ action: 'WORK_ORDER_REASSIGNED' })).toBeNull()
  })

  it('chủ nhà yến tự bắt đầu: người nhận giữ nguyên', async () => {
    const { tech, owner$, raise } = await seed()
    await raise('SPEAKER_FAILURE')
    await owner$.post(`/work-orders/${(await workOrder())._id}/start`).expect(200)
    expect(String((await workOrder()).assignee_id)).toBe(String(tech.user._id))
  })

  it('thợ khác báo xong thì nhận phiếu; mở lại báo người báo xong, không báo người bắt đầu', async () => {
    const { tech, tech2, tech$, tech2$, owner$, raise } = await seed()
    await raise('SPEAKER_FAILURE')
    const { _id } = await workOrder()
    await tech$.post(`/work-orders/${_id}/start`).expect(200)
    await tech2$.post(`/work-orders/${_id}/done`, { cause: 'SPEAKER' }).expect(200)
    expect(String((await workOrder()).assignee_id)).toBe(String(tech2.user._id))

    await verifyWorkOrders()
    expect((await workOrder()).status).toBe('AWAITING_APPROVAL')
    ;(notifyUser as jest.Mock).mockClear()
    await owner$.post(`/work-orders/${_id}/reopen`, { note: 'Loa còn rè' }).expect(200)
    expect(notifiedIds()).toContain(String(tech2.user._id))
    expect(notifiedIds()).not.toContain(String(tech.user._id))
  })
})
