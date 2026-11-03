/**
 * SRS v2.0.0 — cảnh báo suy luận và kiểm chứng của chuyên gia:
 * - ALERT-FR-012: breach NH3/CO2 là MEDIUM, ghi rõ ngưỡng do chuyên gia đặt, không được gửi lại
 * - THREAT-FR-007: NOISE_ANOMALY (firmware cũ gửi BIRD_PANIC vẫn nhận), không được gửi lại
 * - EXPERT-FR-003: PUT /alerts/:id/verdict, lọc danh sách, thống kê tỷ lệ xác nhận
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import alertRoutes from '@/routes/alerts.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import {
  EPISODE_CLEAR_MS, findThresholdBreaches, ingestDeviceAlert, raiseThresholdAlert, renotifyStaleAlerts, resolveStaleEpisodeAlerts,
} from '@/services/alert.service'
import { dispatchAlertNotification } from '@/services/notification.service'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import type { AlertType, Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn() }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/alerts', alertRoutes)
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
  await Promise.all([Alert, AuditLog, SensorNode, Farm, House, Zone, User].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const call = (method: 'get' | 'put', path: string, token: string, body: object = {}) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  const node = await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const mkAlert = (type: AlertType) =>
    Alert.create({ farm_id: farm._id, zone_id: zone._id, node_id: node._id, type, severity: 'MEDIUM', title: 't', message: 'm' })
  return { owner, expert, farm, zone, node, mkAlert, t: { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') } }
}

/** Đẩy mọi cảnh báo về 20 phút trước rồi chạy job gửi lại (ALERT-FR-015) — trả số cảnh báo được gửi lại */
async function renotifiedAfterEscalation() {
  await Alert.collection.updateMany({}, { $set: { created_at: new Date(Date.now() - 20 * 60_000) } })
  return renotifyStaleAlerts()
}

describe('NH3/CO2 chỉ cảnh báo (ALERT-FR-012)', () => {
  it('breach NH3 là MEDIUM, ghi rõ ngưỡng do chuyên gia đặt, không được gửi lại', async () => {
    const { zone, node } = await seed()
    const breaches = findThresholdBreaches(
      { temperature: 28, humidity: 85, light_lux: 0.1, nh3_ppm: DEFAULT_THRESHOLDS.nh3_max + 10, co2_ppm: 800 }, DEFAULT_THRESHOLDS,
    )
    await raiseThresholdAlert(String(zone._id), String(node._id), breaches)

    const alert = (await Alert.findOne({ type: 'THRESHOLD_BREACH' }).lean())!
    expect(alert.severity).toBe('MEDIUM')
    expect(alert.message).toContain('NH3')
    expect(alert.message).toContain('không tự chạy quạt')
    expect(await renotifiedAfterEscalation()).toBe(0)
  })

  it('breach nhiệt độ không kèm ghi chú chất lượng không khí', async () => {
    const { zone, node } = await seed()
    await raiseThresholdAlert(String(zone._id), String(node._id), [{ metric: 'temperature', value: 36, limit: 31, direction: 'above' }])
    expect((await Alert.findOne().lean())!.message).not.toContain('chuyên gia')
  })

  it('thiết bị gửi THRESHOLD_BREACH mức HIGH vẫn bị giữ ở MEDIUM — không được gửi lại', async () => {
    const { node } = await seed()
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'THRESHOLD_BREACH', severity: 'HIGH', message: 'NH3 cao' })
    expect((await Alert.findOne().lean())!.severity).toBe('MEDIUM')
    expect(await renotifiedAfterEscalation()).toBe(0)
  })

  it('firmware không gửi title: tiêu đề mặc định mang tên Zone', async () => {
    const { zone, node } = await seed()
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'MISTING_INEFFECTIVE', severity: 'MEDIUM', message: 'khô' })
    expect((await Alert.findOne().lean())!.title).toBe(`MISTING_INEFFECTIVE tại ${zone.name}`)
  })

  it('thiết bị không được gửi loại cảnh báo chỉ backend suy ra', async () => {
    const { node } = await seed()
    for (const type of ['NODE_OFFLINE', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'MAINTENANCE_DUE']) {
      await expect(ingestDeviceAlert({ deviceId: node.device_id, type, message: 'x' })).rejects.toThrow('không hợp lệ')
    }
    expect(await Alert.countDocuments()).toBe(0)
  })

  it('loại cảnh báo phần cứng vẫn giữ mức thiết bị gửi và vẫn được gửi lại', async () => {
    const { node } = await seed()
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'SPEAKER_FAILURE', severity: 'CRITICAL', message: 'x' })
    expect((await Alert.findOne().lean())!.severity).toBe('CRITICAL')
    expect(await renotifiedAfterEscalation()).toBe(1)
  })
})

describe('NOISE_ANOMALY (THREAT-FR-007)', () => {
  it('firmware < 1.3.0 gửi BIRD_PANIC được lưu thành NOISE_ANOMALY, mức MEDIUM, không được gửi lại', async () => {
    const { node } = await seed()
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'BIRD_PANIC', severity: 'CRITICAL', message: 'ồn' })
    const alert = (await Alert.findOne().lean())!
    expect(alert.type).toBe('NOISE_ANOMALY')
    expect(alert.severity).toBe('MEDIUM')
    expect(await renotifiedAfterEscalation()).toBe(0)
  })
})

describe('kiểm chứng của Domain Expert (EXPERT-FR-003)', () => {
  it('chỉ Domain Expert ghi được kết quả; lưu người, thời điểm, ghi chú và audit; ghi lại được', async () => {
    const { expert, mkAlert, t } = await seed()
    const alert = await mkAlert('NOISE_ANOMALY')

    // Farm đã có chuyên gia: Farm Owner không kết luận thay (BR-22)
    await call('put', `/alerts/${alert._id}/verdict`, t.owner, { result: 'CONFIRMED' }).expect(403)
    await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'MAYBE' }).expect(422)
    const res = await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'REJECTED', note: 'Chim về tổ như mọi ngày' }).expect(200)
    expect(res.body.data.expert_verdict).toMatchObject({
      result: 'REJECTED', note: 'Chim về tổ như mọi ngày', role: 'DOMAIN_EXPERT', by: { _id: String(expert._id), full_name: 'E' },
    })
    // SM-01 — bác bỏ đưa cảnh báo ra khỏi danh sách còn hiệu lực, nhớ trạng thái cũ
    expect(res.body.data).toMatchObject({ status: 'DISMISSED', previous_status: 'ACTIVE' })

    const back = await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'CONFIRMED' }).expect(200)
    expect(back.body.data.status).toBe('ACTIVE')
    expect(back.body.data.previous_status).toBeUndefined()
    expect((await Alert.findById(alert._id).lean())!.expert_verdict!.result).toBe('CONFIRMED')
    expect(await AuditLog.countDocuments({ action: 'ALERT_VERDICT_SET' })).toBe(2)
  })

  it('từ chối cảnh báo đo trực tiếp và cảnh báo của farm khác', async () => {
    const { mkAlert, t } = await seed()
    const direct = await mkAlert('THRESHOLD_BREACH')
    await call('put', `/alerts/${direct._id}/verdict`, t.expert, { result: 'CONFIRMED' }).expect(400)

    const other = await seed()
    const foreign = await other.mkAlert('NOISE_ANOMALY')
    await call('put', `/alerts/${foreign._id}/verdict`, t.expert, { result: 'CONFIRMED' }).expect(403)
  })

  it('lọc danh sách theo loại và trạng thái kiểm chứng; thống kê tỷ lệ xác nhận theo loại', async () => {
    const { expert, zone, mkAlert, t } = await seed()
    const [n1, n2, n3] = await Promise.all([mkAlert('NOISE_ANOMALY'), mkAlert('NOISE_ANOMALY'), mkAlert('NOISE_ANOMALY')])
    await mkAlert('FORECAST_BREACH')
    await mkAlert('THRESHOLD_BREACH') // đo trực tiếp — không nằm trong hàng chờ kiểm chứng
    const verdict = (result: string) => ({ expert_verdict: { result, by: expert._id, at: new Date() } })
    await Alert.updateOne({ _id: n1._id }, verdict('CONFIRMED'))
    await Alert.updateOne({ _id: n2._id }, verdict('REJECTED'))
    await Alert.updateOne({ _id: n3._id }, verdict('REJECTED'))

    const pending = await call('get', '/alerts?verdict=pending', t.expert).expect(200)
    expect(pending.body.data.map((a: { type: string }) => a.type)).toEqual(['FORECAST_BREACH'])
    expect((await call('get', '/alerts?verdict=rejected', t.expert).expect(200)).body.meta.total).toBe(2)
    expect((await call('get', '/alerts?type=NOISE_ANOMALY', t.expert).expect(200)).body.meta.total).toBe(3)

    const stats = await call('get', `/alerts/verdict-stats?zoneId=${zone._id}`, t.owner).expect(200)
    expect(stats.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'NOISE_ANOMALY', confirmed: 1, rejected: 2, pending: 0, confirmedPct: 33 }),
      expect.objectContaining({ type: 'FORECAST_BREACH', confirmed: 0, rejected: 0, pending: 1, confirmedPct: null }),
    ]))
  })

  it('thống kê tách theo vai trò người kết luận; kết luận cũ không có vai trò tính cho Domain Expert', async () => {
    const { owner, expert, zone, mkAlert, t } = await seed()
    const [n1, n2, n3] = await Promise.all([mkAlert('NOISE_ANOMALY'), mkAlert('NOISE_ANOMALY'), mkAlert('NOISE_ANOMALY')])
    await Alert.updateOne({ _id: n1._id }, { expert_verdict: { result: 'CONFIRMED', by: expert._id, role: 'DOMAIN_EXPERT', at: new Date() } })
    await Alert.updateOne({ _id: n2._id }, { expert_verdict: { result: 'REJECTED', by: owner._id, role: 'FARM_OWNER', at: new Date() } })
    await Alert.updateOne({ _id: n3._id }, { expert_verdict: { result: 'REJECTED', by: expert._id, at: new Date() } })

    const stats = await call('get', `/alerts/verdict-stats?zoneId=${zone._id}`, t.expert).expect(200)
    const noise = stats.body.data.find((s: { type: string }) => s.type === 'NOISE_ANOMALY')
    expect(noise.byRole).toEqual({
      DOMAIN_EXPERT: { confirmed: 1, rejected: 1 },
      FARM_OWNER: { confirmed: 0, rejected: 1 },
    })
  })
})

describe('cảnh báo bị bác bỏ — DISMISSED (SM-01, EXPERT-FR-003, ALERT-FR-007/008)', () => {
  beforeEach(() => jest.mocked(dispatchAlertNotification).mockClear())

  it('bác bỏ bắt buộc ghi lý do (422)', async () => {
    const { mkAlert, t } = await seed()
    const alert = await mkAlert('NOISE_ANOMALY')
    await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'REJECTED' }).expect(422)
    await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'REJECTED', note: '   ' }).expect(422)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('ACTIVE')
  })

  it('bác bỏ cảnh báo đã xác nhận nhớ ACKNOWLEDGED; xác nhận lại thì về đúng trạng thái đó và báo lại Farm Owner', async () => {
    const { mkAlert, t } = await seed()
    const alert = await mkAlert('SENSOR_ANOMALY')
    await Alert.updateOne({ _id: alert._id }, { status: 'ACKNOWLEDGED' })

    await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'REJECTED', note: 'Cảm biến vừa được lau' }).expect(200)
    expect(await Alert.findById(alert._id).lean()).toMatchObject({ status: 'DISMISSED', previous_status: 'ACKNOWLEDGED' })
    expect(dispatchAlertNotification).not.toHaveBeenCalled()

    await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'CONFIRMED' }).expect(200)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('ACKNOWLEDGED')
    expect(dispatchAlertNotification).toHaveBeenCalledTimes(1)
  })

  it('kết luận trên cảnh báo đã đóng không đổi trạng thái', async () => {
    const { mkAlert, t } = await seed()
    const alert = await mkAlert('FORECAST_BREACH')
    await Alert.updateOne({ _id: alert._id }, { status: 'RESOLVED', resolved_at: new Date() })
    await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'REJECTED', note: 'Dự báo sai' }).expect(200)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('Farm Owner xác nhận cảnh báo ACTIVE kèm người, lúc, ghi chú; cảnh báo bị bác bỏ hoặc đã đóng → 409', async () => {
    const { owner, mkAlert, t } = await seed()
    const active = await mkAlert('NOISE_ANOMALY')
    const ack = await call('put', `/alerts/${active._id}/acknowledge`, t.owner, { note: 'Đã kiểm tra' }).expect(200)
    expect(ack.body.data).toMatchObject({ status: 'ACKNOWLEDGED', acknowledged_by: String(owner._id), acknowledgement_note: 'Đã kiểm tra' })
    expect(ack.body.data.acknowledged_at).toEqual(expect.any(String))

    const dismissed = await mkAlert('NOISE_ANOMALY')
    await call('put', `/alerts/${dismissed._id}/verdict`, t.expert, { result: 'REJECTED', note: 'Tiếng mưa' }).expect(200)
    await call('put', `/alerts/${dismissed._id}/acknowledge`, t.owner, { note: 'ok' }).expect(409)
    expect((await Alert.findById(dismissed._id).lean())!.status).toBe('DISMISSED')

    const resolved = await mkAlert('FORECAST_BREACH')
    await Alert.updateOne({ _id: resolved._id }, { status: 'RESOLVED', resolved_at: new Date() })
    await call('put', `/alerts/${resolved._id}/acknowledge`, t.owner, { note: 'ok' }).expect(409)
    expect((await Alert.findById(resolved._id).lean())!.status).toBe('RESOLVED')
  })

  it('gặp lại cùng sự cố: gộp vào cảnh báo DISMISSED, không tạo mới, không thông báo; hết đợt thì tự đóng', async () => {
    const { node, mkAlert, t } = await seed()
    const alert = await mkAlert('NOISE_ANOMALY')
    await call('put', `/alerts/${alert._id}/verdict`, t.expert, { result: 'REJECTED', note: 'Tiếng mưa' }).expect(200)
    // Lần ghi nhận trước đã quá 1 phút → lần này được đếm (ALERT_SEEN_UPDATE_MS)
    await Alert.updateOne({ _id: alert._id }, { last_seen_at: new Date(Date.now() - 2 * 60_000) })
    jest.mocked(dispatchAlertNotification).mockClear()

    await ingestDeviceAlert({ deviceId: node.device_id, type: 'NOISE_ANOMALY', message: 'ồn' })
    expect(await Alert.countDocuments()).toBe(1)
    expect(await Alert.findById(alert._id).lean()).toMatchObject({ status: 'DISMISSED', occurrence_count: 2 })
    expect(dispatchAlertNotification).not.toHaveBeenCalled()

    await resolveStaleEpisodeAlerts(new Date(Date.now() + EPISODE_CLEAR_MS + 60_000))
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('lọc danh sách theo status=DISMISSED; danh sách có tên người bác bỏ', async () => {
    const { mkAlert, t } = await seed()
    const [dismissed] = await Promise.all([mkAlert('NOISE_ANOMALY'), mkAlert('NOISE_ANOMALY')])
    await call('put', `/alerts/${dismissed._id}/verdict`, t.expert, { result: 'REJECTED', note: 'Tiếng mưa' }).expect(200)

    const res = await call('get', '/alerts?status=DISMISSED', t.owner).expect(200)
    expect(res.body.meta.total).toBe(1)
    expect(res.body.data[0].expert_verdict.by).toMatchObject({ full_name: 'E' })
    expect((await call('get', '/alerts?status=ACTIVE', t.owner).expect(200)).body.meta.total).toBe(1)
  })
})
