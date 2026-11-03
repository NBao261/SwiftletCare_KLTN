/**
 * Vòng đời cảnh báo: cảnh báo theo đợt tự đóng, bộ lọc GET /alerts, giới hạn mức độ và loại
 * cảnh báo thiết bị được gửi.
 */
import express from 'express'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { EPISODE_CLEAR_MS, createAlert, ingestDeviceAlert, resolveStaleEpisodeAlerts } from '@/services/alert.service'
import { seedOwnerFarm as seed, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
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
app.use('/alerts', alertRoutes)
app.use(errorHandler)

useTestDb()

describe('cảnh báo theo đợt tự đóng để lần tái phát không bị nuốt (ALERT-FR-008, EXPERT-FR-003)', () => {
  it('NOISE_ANOMALY/MISTING_INEFFECTIVE không tái phát 60 phút thì đóng; lần sau là cảnh báo mới', async () => {
    const { node } = await seed()
    const noise = () => ingestDeviceAlert({ deviceId: node.device_id, type: 'NOISE_ANOMALY', message: 'ồn' })

    expect(await noise()).not.toBeNull()
    expect(await noise()).toBeNull() // cùng đợt: dedup
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'MISTING_INEFFECTIVE', message: 'khô' })
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'SPEAKER_FAILURE', severity: 'HIGH', message: 'loa' })

    expect(await resolveStaleEpisodeAlerts()).toBe(0) // vừa ghi nhận xong — chưa đóng
    const later = new Date(Date.now() + EPISODE_CLEAR_MS + 60_000)
    expect(await resolveStaleEpisodeAlerts(later)).toBe(2)
    expect(await Alert.countDocuments({ status: 'RESOLVED', type: { $in: ['NOISE_ANOMALY', 'MISTING_INEFFECTIVE'] } })).toBe(2)
    // Lỗi phần cứng không có tín hiệu hết thì không tự đóng theo thời gian
    expect((await Alert.findOne({ type: 'SPEAKER_FAILURE' }).lean())!.status).toBe('ACTIVE')

    expect(await noise()).not.toBeNull() // đợt mới → bản ghi mới, được thông báo và kiểm chứng riêng
    expect(await Alert.countDocuments({ type: 'NOISE_ANOMALY' })).toBe(2)
  })

  it('đợt đã được chuyên gia kiểm chứng vẫn giữ kết quả sau khi tự đóng', async () => {
    const { owner, node } = await seed()
    const alert = (await ingestDeviceAlert({ deviceId: node.device_id, type: 'NOISE_ANOMALY', message: 'ồn' }))!
    await Alert.updateOne({ _id: alert._id }, { expert_verdict: { result: 'REJECTED', by: owner._id, at: new Date() } })

    await resolveStaleEpisodeAlerts(new Date(Date.now() + EPISODE_CLEAR_MS + 60_000))
    const after = (await Alert.findById(alert._id).lean())!
    expect(after.status).toBe('RESOLVED')
    expect(after.expert_verdict!.result).toBe('REJECTED')
  })

  it('tự đóng cảnh báo theo đợt giữ nguyên ghi chú xác nhận của Farm Owner', async () => {
    const { node } = await seed()
    const acked = (await ingestDeviceAlert({ deviceId: node.device_id, type: 'MISTING_INEFFECTIVE', message: 'khô' }))!
    await Alert.updateOne({ _id: acked._id }, { status: 'ACKNOWLEDGED', acknowledgement_note: 'Đã châm nước lúc 7h' })
    const plain = (await ingestDeviceAlert({ deviceId: node.device_id, type: 'NOISE_ANOMALY', message: 'ồn' }))!

    expect(await resolveStaleEpisodeAlerts(new Date(Date.now() + EPISODE_CLEAR_MS + 60_000))).toBe(2)
    expect((await Alert.findById(acked._id).lean())!).toMatchObject({ status: 'RESOLVED', acknowledgement_note: 'Đã châm nước lúc 7h' })
    expect((await Alert.findById(plain._id).lean())!.acknowledgement_note).toContain('đợt sự cố đã qua')
  })
})

describe('bộ lọc GET /alerts (ALERT-FR-007, EXPERT-FR-003)', () => {
  it('bộ lọc GET /alerts chỉ nhận giá trị hợp lệ — toán tử Mongo trong query bị từ chối', async () => {
    const { farm, zone, node, token } = await seed()
    const base = { farm_id: farm._id, zone_id: zone._id, node_id: node._id, severity: 'MEDIUM', title: 't', message: 'm' }
    await Alert.create([{ ...base, type: 'NODE_OFFLINE' }, { ...base, type: 'NOISE_ANOMALY' }])
    const get = (qs: string) => request(app).get(`/alerts?${qs}`).set('Authorization', `Bearer ${token}`)

    await get('type[$ne]=NODE_OFFLINE').expect(422)
    await get('verdict=pending&type[$ne]=x').expect(422)
    await get('status[$ne]=RESOLVED').expect(422)
    await get('severity[$in][]=LOW').expect(422)
    await get('type=KHONG_CO').expect(422)
    // Hàng chờ và hành động phải khớp: loại không kiểm chứng được thì không lọc theo verdict
    await get('verdict=pending&type=NODE_OFFLINE').expect(400)
    await get('verdict=confirmed&type=THRESHOLD_BREACH').expect(400)
    expect((await get('verdict=pending&type=NOISE_ANOMALY').expect(200)).body.meta.total).toBe(1)
    // Hàng chờ kiểm chứng chỉ gồm cảnh báo suy luận
    const pending = await get('verdict=pending').expect(200)
    expect(pending.body.data.map((a: { type: string }) => a.type)).toEqual(['NOISE_ANOMALY'])
  })

  it('tham số lặp trên GET /alerts bị từ chối thay vì gây lỗi 500', async () => {
    const { token } = await seed()
    const get = (qs: string) => request(app).get(`/alerts?${qs}`).set('Authorization', `Bearer ${token}`)
    await get('verdict=confirmed&verdict=confirmed').expect(422)
    await get('type=NOISE_ANOMALY&type=MISTING_INEFFECTIVE').expect(422)
    await get('status=ACTIVE&status=RESOLVED').expect(422)
    await get('severity=LOW&severity=HIGH').expect(422)
  })
})

describe('mức độ và loại cảnh báo: cảnh báo suy luận không lên HIGH, loại lạ bị từ chối', () => {
  it('giới hạn mức độ nằm ở createAlert: nguồn nào cũng không đẩy được cảnh báo suy luận lên HIGH', async () => {
    const { farm, zone, node } = await seed()
    const input = { farmId: String(farm._id), zoneId: String(zone._id), nodeId: String(node._id), title: 't', message: 'm' }
    expect((await createAlert({ ...input, type: 'LOW_RETURN_RATE', severity: 'CRITICAL' }))!.severity).toBe('MEDIUM')
    expect((await createAlert({ ...input, type: 'FORECAST_BREACH' }))!.severity).toBe('LOW') // mặc định thấp hơn thì giữ nguyên
    expect((await createAlert({ ...input, type: 'UNEXPECTED_RESTART', severity: 'CRITICAL' }))!.severity).toBe('CRITICAL')
  })

  it('thiết bị gửi loại cảnh báo không hợp lệ (kể cả tên thuộc tính của Object) bị từ chối', async () => {
    const { node } = await seed()
    await expect(ingestDeviceAlert({ deviceId: node.device_id, type: 'constructor' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(ingestDeviceAlert({ deviceId: node.device_id, type: { $ne: 1 } })).rejects.toMatchObject({ statusCode: 404 })
    expect(await Alert.countDocuments()).toBe(0)
  })
})

describe('tên cảnh báo theo SRS 3.1.0 (G-01)', () => {
  it('firmware cũ gửi PUMP_DRY, POWER_OUTAGE, BIRD_PANIC thì lưu tên mới (THREAT-FR-011, 012)', async () => {
    const { node } = await seed()
    for (const [sent, stored] of [['PUMP_DRY', 'MISTING_INEFFECTIVE'], ['POWER_OUTAGE', 'UNEXPECTED_RESTART'], ['BIRD_PANIC', 'NOISE_ANOMALY']]) {
      const alert = (await ingestDeviceAlert({ deviceId: node.device_id, type: sent }))!
      expect(alert.type).toBe(stored)
    }
  })

  it('mức mặc định theo BR-15 cho loại mới và loại đổi tên', async () => {
    const { farm, zone, node } = await seed()
    const input = { farmId: String(farm._id), zoneId: String(zone._id), nodeId: String(node._id), title: 't', message: 'm' }
    expect((await createAlert({ ...input, type: 'UNEXPECTED_RESTART' }))!.severity).toBe('HIGH')
    expect((await createAlert({ ...input, type: 'ACTUATOR_FAULT' }))!.severity).toBe('HIGH')
    expect((await createAlert({ ...input, type: 'MISTING_INEFFECTIVE' }))!.severity).toBe('MEDIUM')
    expect((await createAlert({ ...input, type: 'CONFIG_MISMATCH' }))!.severity).toBe('MEDIUM')
  })

  it('UNEXPECTED_RESTART mang reset_reason: lấy trong cảnh báo, thiếu thì lấy từ heartbeat gần nhất', async () => {
    const { node } = await seed()
    const sent = (await ingestDeviceAlert({ deviceId: node.device_id, type: 'UNEXPECTED_RESTART', resetReason: 'WATCHDOG' }))!
    expect(sent.metadata).toMatchObject({ reset_reason: 'WATCHDOG' })
    // Report 4 §6.1 — chi tiết theo ERD (metadata giữ cho client cũ)
    expect(sent.details).toEqual({ reset_reason: 'WATCHDOG' })

    await Alert.deleteMany({})
    await SensorNode.updateOne({ _id: node._id }, { reset_reason: 'POWER_ON' })
    const fromHeartbeat = (await ingestDeviceAlert({ deviceId: node.device_id, type: 'POWER_OUTAGE' }))!
    expect(fromHeartbeat.metadata).toMatchObject({ reset_reason: 'POWER_ON' })
    expect(fromHeartbeat.details).toEqual({ reset_reason: 'POWER_ON' })
  })

  it('thiết bị không được tự gửi CONFIG_MISMATCH (backend tự tính, ENV-FR-027); ACTUATOR_FAULT thì nhận', async () => {
    const { node } = await seed()
    await expect(ingestDeviceAlert({ deviceId: node.device_id, type: 'CONFIG_MISMATCH' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(ingestDeviceAlert({ deviceId: node.device_id, type: 'PREDATOR_DETECTED' })).rejects.toMatchObject({ statusCode: 400 })
    expect((await ingestDeviceAlert({ deviceId: node.device_id, type: 'ACTUATOR_FAULT' }))!.type).toBe('ACTUATOR_FAULT')
  })
})
