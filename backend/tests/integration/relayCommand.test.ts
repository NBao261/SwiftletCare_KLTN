/**
 * Lệnh relay và can thiệp tay: lịch sử override không bao giờ chặn lệnh, thời hạn hợp lệ,
 * dời thiết bị sang Zone khác thì override cũ kết thúc; bật bơm tối đa 30 phút và phải xác nhận khi
 * Zone có cảnh báo cảm biến/phun sương (BR-08, ENV-FR-016, TC-F17-02); huỷ 1 relay hoặc tất cả (BR-20).
 */
import express from 'express'
import mongoose from 'mongoose'
import request from 'supertest'
import deviceRoutes from '@/routes/devices.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { RelayOverrideLog } from '@/models/relayOverrideLog.model'
import { publishDeviceCommand, publishDeviceConfig } from '@/mqtt/mqtt.client'
import { confirmRelayStatus, expireManualOverrides, reassignZone } from '@/services/device.service'
import { seedOwnerFarm as seed, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use(errorHandler)

useTestDb()

describe('lịch sử can thiệp tay không được chặn lệnh điều khiển (ENV-FR-019)', () => {
  it('ghi lịch sử lỗi: relay vẫn nhận lệnh và API vẫn trả 200', async () => {
    const { relay, token } = await seed()
    jest.spyOn(RelayOverrideLog, 'create').mockRejectedValue(new Error('db down') as never)

    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    expect(publishDeviceCommand).toHaveBeenCalledWith(expect.any(String), 'RELAY', expect.objectContaining({ relayName: 'misting', state: true }))
  })

  it('đóng lịch sử lỗi: thiết bị vẫn nhận clear_override', async () => {
    const { relay, token } = await seed()
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    jest.clearAllMocks()
    jest.spyOn(RelayOverrideLog, 'updateMany').mockRejectedValue(new Error('db down') as never)

    await request(app).delete(`${relay}/relay-override`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(publishDeviceCommand).toHaveBeenCalledWith(expect.any(String), 'CLEAR_OVERRIDE')
  })

  it('override hết hạn: lịch sử đóng tại đúng hạn, không phải lúc job chạy', async () => {
    const { node, relay, token } = await seed()
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    const expiry = new Date(Date.now() - 45_000) // job chạy trễ 45 giây sau hạn
    await SensorNode.updateOne({ _id: node._id }, { 'relays.misting.override_expiry': expiry })
    // Override bật trước hạn của nó (như thật) — ended_at không bao giờ sớm hơn started_at
    await RelayOverrideLog.updateOne({}, { started_at: new Date(expiry.getTime() - 60_000) })

    expect(await expireManualOverrides()).toBe(1)
    const log = (await RelayOverrideLog.findOne().lean())!
    expect(log.end_reason).toBe('EXPIRED')
    expect(log.ended_at!.getTime()).toBe(expiry.getTime())
  })
})

describe('thời hạn của lệnh can thiệp tay (ENV-FR-018)', () => {
  it('durationMs của lệnh relay phải là số nguyên trong khoảng cho phép', async () => {
    const { node, relay, token } = await seed()
    const post = (durationMs: unknown) =>
      request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true, durationMs })

    await post(10 * 365 * 24 * 3600_000).expect(422) // 10 năm
    await post(-5000).expect(422)
    await post(5000).expect(422) // ngắn hơn cửa sổ bỏ qua bản tin AUTO cũ
    await post('abc').expect(422)
    expect(await RelayOverrideLog.countDocuments()).toBe(0)
    expect((await SensorNode.findById(node._id))!.control_mode).toBe('AUTO')
    await post(600_000).expect(200)
  })
})

describe('bật bơm tay: tối đa 30 phút, xác nhận khi có cảnh báo (BR-08, ENV-FR-016)', () => {
  const MIN = 60_000

  async function seedWithAlert(type?: string, status = 'ACTIVE', otherZone = false) {
    const s = await seed()
    if (type) {
      const zoneId = otherZone ? (await seed()).zone._id : s.zone._id
      await Alert.create({ farm_id: s.farm._id, zone_id: zoneId, node_id: s.node._id, type, status, severity: 'MEDIUM', title: `${type} tại Z`, message: 'm' })
    }
    const post = (body: object) => request(app).post(`${s.relay}/relay`).set('Authorization', `Bearer ${s.token}`).send(body)
    return { ...s, post }
  }

  it('TC-F17-02: có SENSOR_FAULT — bơm 31 phút 422; 10 phút chưa xác nhận 409 kèm cảnh báo; xác nhận rồi thì bật, lịch sử ghi đã xác nhận', async () => {
    const { node, post } = await seedWithAlert('SENSOR_FAULT')

    await post({ relayName: 'misting', state: true, durationMs: 31 * MIN, confirmed: true }).expect(422)

    const refused = await post({ relayName: 'misting', state: true, durationMs: 10 * MIN }).expect(409)
    expect(refused.body.error.code).toBe('CONFIRMATION_REQUIRED')
    expect(refused.body.error.details).toEqual([expect.objectContaining({ type: 'SENSOR_FAULT', title: 'SENSOR_FAULT tại Z' })])
    expect((await SensorNode.findById(node._id))!.control_mode).toBe('AUTO')
    expect(await RelayOverrideLog.countDocuments()).toBe(0)
    expect(publishDeviceCommand).not.toHaveBeenCalled()

    await post({ relayName: 'misting', state: true, durationMs: 10 * MIN, confirmed: true }).expect(200)
    expect(await RelayOverrideLog.findOne().lean()).toMatchObject({ relay: 'misting', state: true, alert_confirmed: true })
    expect(publishDeviceCommand).toHaveBeenCalledWith(expect.any(String), 'RELAY', { relayName: 'misting', state: true, durationMs: 10 * MIN })
  })

  it('RS485_BUS_FAILURE và MISTING_INEFFECTIVE đã xác nhận (ACKNOWLEDGED) cũng bắt xác nhận', async () => {
    for (const [type, status] of [['RS485_BUS_FAILURE', 'ACTIVE'], ['MISTING_INEFFECTIVE', 'ACKNOWLEDGED']]) {
      const { post } = await seedWithAlert(type, status)
      await post({ relayName: 'misting', state: true }).expect(409)
    }
  })

  it('không có cảnh báo: bơm đúng 30 phút được, lịch sử không đánh dấu xác nhận', async () => {
    const { post } = await seedWithAlert()
    await post({ relayName: 'misting', state: true, durationMs: 30 * MIN }).expect(200)
    expect((await RelayOverrideLog.findOne().lean())!.alert_confirmed).toBe(false)
  })

  it('giới hạn 30 phút và xác nhận chỉ áp cho BẬT bơm: tắt bơm, quạt, loa vẫn tới 24 giờ', async () => {
    const { post } = await seedWithAlert('SENSOR_FAULT')
    await post({ relayName: 'misting', state: false, durationMs: 2 * 60 * MIN }).expect(200)
    await post({ relayName: 'ventilation', state: true, durationMs: 2 * 60 * MIN }).expect(200)
    await post({ relayName: 'speaker', state: true, durationMs: 2 * 60 * MIN }).expect(200)
  })

  it('cảnh báo đã đóng hoặc ở zone khác không bắt xác nhận', async () => {
    await (await seedWithAlert('SENSOR_FAULT', 'RESOLVED')).post({ relayName: 'misting', state: true }).expect(200)
    await (await seedWithAlert('SENSOR_FAULT', 'ACTIVE', true)).post({ relayName: 'misting', state: true }).expect(200)
  })
})

describe('huỷ can thiệp tay 1 relay hoặc tất cả (ENV-FR-018, BR-20)', () => {
  async function overridden() {
    const s = await seed()
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${s.token}`)
    await auth(request(app).post(`${s.relay}/relay`)).send({ relayName: 'misting', state: true, durationMs: 600_000 }).expect(200)
    await auth(request(app).post(`${s.relay}/relay`)).send({ relayName: 'ventilation', state: true, durationMs: 600_000 }).expect(200)
    jest.mocked(publishDeviceCommand).mockClear()
    const clear = (relayName?: string) =>
      auth(request(app).delete(`${s.relay}/relay-override${relayName ? `?relayName=${relayName}` : ''}`))
    return { ...s, clear }
  }
  const openLogs = async () => (await RelayOverrideLog.find({ ended_at: null }).lean()).map(l => l.relay).sort()

  it('huỷ riêng bơm: lịch sử bơm CLEARED_EARLY, quạt vẫn tay, thiết bị vẫn MANUAL; huỷ nốt quạt thì về AUTO', async () => {
    const { node, clear } = await overridden()

    await clear('misting').expect(200)
    expect(publishDeviceCommand).toHaveBeenCalledWith(node.device_id, 'CLEAR_OVERRIDE', { relayName: 'misting' })
    expect(await openLogs()).toEqual(['ventilation'])
    expect((await RelayOverrideLog.findOne({ relay: 'misting' }).lean())!.end_reason).toBe('CLEARED_EARLY')
    expect((await SensorNode.findById(node._id))!.control_mode).toBe('MANUAL')

    await clear('ventilation').expect(200)
    expect(await openLogs()).toEqual([])
    const after = (await SensorNode.findById(node._id))!
    expect(after.control_mode).toBe('AUTO')
    expect(after.override_expiry).toBeUndefined()
  })

  it('huỷ relay không đang can thiệp tay (loa): không gửi lệnh, không ghi audit, bơm và quạt vẫn tay', async () => {
    const { node, clear } = await overridden()
    await clear('speaker').expect(200)
    expect(publishDeviceCommand).not.toHaveBeenCalled()
    expect(await AuditLog.countDocuments({ action: 'RELAY_OVERRIDE_CLEARED' })).toBe(0)
    expect(await openLogs()).toEqual(['misting', 'ventilation'])
    expect((await SensorNode.findById(node._id))!.control_mode).toBe('MANUAL')
  })

  it('không chọn relay → huỷ tất cả như trước; tên relay sai → 422', async () => {
    const { node, clear } = await overridden()
    await clear('heating').expect(422)
    await clear().expect(200)
    expect(publishDeviceCommand).toHaveBeenCalledWith(node.device_id, 'CLEAR_OVERRIDE')
    expect(await openLogs()).toEqual([])
    expect((await SensorNode.findById(node._id))!.control_mode).toBe('AUTO')
  })
})

describe('mỗi relay một hạn (BR-20, ENV-FR-018)', () => {
  const MIN = 60_000

  async function twoRelays() {
    const s = await seed()
    const post = (relayName: string, durationMs: number) => request(app).post(`${s.relay}/relay`)
      .set('Authorization', `Bearer ${s.token}`).send({ relayName, state: true, durationMs }).expect(200)
    await post('misting', 10 * MIN)
    const mistingExpiry = (await SensorNode.findById(s.node._id))!.relays.misting.override_expiry!
    await post('ventilation', 20 * MIN)
    // Đã qua cửa sổ bỏ qua bản tin AUTO cũ
    await RelayOverrideLog.updateMany({}, { started_at: new Date(Date.now() - MIN) })
    jest.mocked(publishDeviceCommand).mockClear()
    return { ...s, mistingExpiry }
  }
  const status = (deviceId: string, relays: object) => confirmRelayStatus({
    deviceId, relay_states: { misting: true, speaker: false, ventilation: true }, control_mode: 'MANUAL', relays,
  })

  it('MANUAL → MANUAL: bật tay relay thứ hai, relay đầu giữ hạn của nó', async () => {
    const { node, mistingExpiry } = await twoRelays()
    const after = (await SensorNode.findById(node._id))!
    expect(after.relays.misting).toMatchObject({ mode: 'MANUAL', override_expiry: mistingExpiry })
    expect(after.relays.ventilation.mode).toBe('MANUAL')
    expect(after.relays.ventilation.override_expiry!.getTime()).toBeGreaterThan(mistingExpiry.getTime())
    expect(after.relays.speaker.mode).toBe('AUTO')
    expect(after.control_mode).toBe('MANUAL')
    expect(after.override_expiry).toEqual(after.relays.ventilation.override_expiry)
    expect(String(after.relays.misting.override_by)).toBeTruthy()
  })

  it('hết hạn 1 relay: relay kia vẫn MANUAL, chỉ gửi clear_override của relay đó', async () => {
    const { node } = await twoRelays()
    const past = new Date(Date.now() - 1000)
    await SensorNode.updateOne({ _id: node._id }, { 'relays.misting.override_expiry': past })

    expect(await expireManualOverrides()).toBe(1)

    expect(publishDeviceCommand).toHaveBeenCalledTimes(1)
    expect(publishDeviceCommand).toHaveBeenCalledWith(node.device_id, 'CLEAR_OVERRIDE', { relayName: 'misting' })
    expect(await RelayOverrideLog.findOne({ relay: 'misting' }).lean()).toMatchObject({ end_reason: 'EXPIRED', ended_at: past })
    expect((await RelayOverrideLog.findOne({ relay: 'ventilation' }).lean())!.ended_at).toBeNull()
    const after = (await SensorNode.findById(node._id))!
    expect(after.relays.misting.mode).toBe('AUTO')
    expect(after.relays.misting.override_expiry).toBeUndefined()
    expect(after.control_mode).toBe('MANUAL')
    expect(after.override_expiry).toEqual(after.relays.ventilation.override_expiry)
  })

  it('relay cuối hết hạn thì thiết bị về AUTO, không còn hạn', async () => {
    const { node } = await twoRelays()
    const past = new Date(Date.now() - 1000)
    await SensorNode.updateOne({ _id: node._id }, { 'relays.misting.override_expiry': past, 'relays.ventilation.override_expiry': past })

    expect(await expireManualOverrides()).toBe(2)
    const after = (await SensorNode.findById(node._id))!
    expect(after.control_mode).toBe('AUTO')
    expect(after.override_expiry).toBeUndefined()
  })

  it('relay/status theo relay: 1 relay về AUTO thì chỉ đóng lịch sử của relay đó', async () => {
    const { node } = await twoRelays()
    await status(node.device_id, { misting: { mode: 'AUTO' }, speaker: { mode: 'AUTO' }, ventilation: { mode: 'MANUAL', remaining_ms: 600_000 } })

    expect((await RelayOverrideLog.findOne({ relay: 'misting' }).lean())!.end_reason).toBe('CLEARED_EARLY')
    expect((await RelayOverrideLog.findOne({ relay: 'ventilation' }).lean())!.ended_at).toBeNull()
    const after = (await SensorNode.findById(node._id))!
    expect(after.relays.misting.mode).toBe('AUTO')
    expect(after.relays.ventilation.mode).toBe('MANUAL')
    expect(after.control_mode).toBe('MANUAL')
  })

  it('relay/status báo MANUAL mà DB không có hạn: lấy thời gian còn lại thiết bị báo', async () => {
    const { node } = await seed()
    await status(node.device_id, { misting: { mode: 'MANUAL', remaining_ms: 5 * MIN } })

    const after = (await SensorNode.findById(node._id))!
    expect(after.relays.misting.mode).toBe('MANUAL')
    expect(after.relays.misting.override_expiry!.getTime() - Date.now()).toBeLessThanOrEqual(5 * MIN)
    expect(after.relays.misting.override_expiry!.getTime() - Date.now()).toBeGreaterThan(4 * MIN)
    expect(after.relays.ventilation.mode).toBe('AUTO')
  })

  it('lệnh trễ bị thiết bị bỏ: relay/status AUTO sau cửa sổ chờ trả relay về AUTO', async () => {
    const { node } = await twoRelays()
    await status(node.device_id, { misting: { mode: 'AUTO' }, ventilation: { mode: 'AUTO' } })
    expect((await SensorNode.findById(node._id))!.control_mode).toBe('AUTO')
    expect(await RelayOverrideLog.countDocuments({ ended_at: null })).toBe(0)
  })
})

describe('dời thiết bị sang Zone khác', () => {
  it('dời thiết bị sang Zone khác: override đang chạy kết thúc ở Zone cũ', async () => {
    const { farm, node, relay, token } = await seed()
    const house2 = await House.create({ farm_id: farm._id, name: 'H2' })
    const zone2 = await Zone.create({ house_id: house2._id, name: 'Z2' })
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    jest.clearAllMocks()

    await reassignZone(String(node._id), { _id: String(new mongoose.Types.ObjectId()), email: 'tech@test.vn', role: 'TECHNICIAN' }, { newZoneId: String(zone2._id) })

    const after = (await SensorNode.findById(node._id))!
    expect(String(after.zone_id)).toBe(String(zone2._id))
    expect(after.control_mode).toBe('AUTO')
    expect(after.override_expiry).toBeUndefined()
    expect((await RelayOverrideLog.findOne().lean())!).toMatchObject({ end_reason: 'CLEARED_EARLY' })
    // Thiết bị không khởi động lại: tự huỷ override đang chạy và nhận cấu hình của Zone mới
    expect(publishDeviceCommand).toHaveBeenCalledWith(node.device_id, 'CLEAR_OVERRIDE')
    expect(publishDeviceConfig).toHaveBeenCalledWith(node.device_id, expect.objectContaining({ deviceId: node.device_id }))
  })
})
