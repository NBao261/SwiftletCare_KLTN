import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { SensorNode } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { EPISODE_CLEAR_MS, createAlert, ingestDeviceAlert, resolveStaleEpisodeAlerts } from '@/services/alert.service'
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

    expect(await resolveStaleEpisodeAlerts()).toBe(0) // vừa ghi nhận xong: chưa đóng
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

describe('ACTUATOR_FAULT — tải không theo relay (THREAT-FR-014, BR-32)', () => {
  const fault = (deviceId: string, extra: Record<string, unknown>) =>
    ingestDeviceAlert({ deviceId, type: 'ACTUATOR_FAULT', message: 'tải không theo relay', ...extra })

  it('mỗi tải một cảnh báo HIGH nêu tải, hướng lỗi và dòng; gửi lại cùng tải chỉ gộp vào cảnh báo đang mở', async () => {
    const { node } = await seed()
    const pump = (await fault(node.device_id, { load: 'misting', fault: 'NO_CURRENT_WHILE_ON', normalCurrentA: 2, currentA: 0.1 }))!
    expect(pump).toMatchObject({
      severity: 'HIGH',
      details: { load: 'misting', fault: 'NO_CURRENT_WHILE_ON', normal_current_a: 2, current_a: 0.1 },
    })
    // Quạt hỏng trên cùng controller là sự cố khác
    expect(await fault(node.device_id, { load: 'ventilation', fault: 'CURRENT_WHILE_OFF', normalCurrentA: 1.5, currentA: 0.9 })).not.toBeNull()
    // Firmware gửi lại khi lỗi bơm còn (EPISODE_ALERT_RESEND_MS)
    expect(await fault(node.device_id, { load: 'misting', fault: 'NO_CURRENT_WHILE_ON', currentA: 0 })).toBeNull()
    expect(await Alert.countDocuments({ type: 'ACTUATOR_FAULT' })).toBe(2)
  })

  it('chi tiết sai kiểu bị bỏ nhưng cảnh báo vẫn được tạo', async () => {
    const { node } = await seed()
    const alert = (await fault(node.device_id, { load: 'heater', fault: 'BURNT', normalCurrentA: -1, currentA: '0.5' }))!
    expect(alert.details).toBeUndefined()
    expect(alert.type).toBe('ACTUATOR_FAULT')
  })

  it('tự đóng khi firmware thôi gửi lại 60 phút (tải đã chạy đúng theo relay)', async () => {
    const { node } = await seed()
    await fault(node.device_id, { load: 'misting', fault: 'NO_CURRENT_WHILE_ON' })
    expect(await resolveStaleEpisodeAlerts()).toBe(0)
    expect(await resolveStaleEpisodeAlerts(new Date(Date.now() + EPISODE_CLEAR_MS + 60_000))).toBe(1)
    expect((await Alert.findOne({ type: 'ACTUATOR_FAULT' }).lean())!.status).toBe('RESOLVED')
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
    await get('open=true&open=true').expect(422)
  })

  it('open=true chỉ trả cảnh báo còn hiệu lực, unreadCount là số ACTIVE (ALERT-FR-007)', async () => {
    const { farm, zone, node, token } = await seed()
    const base = { farm_id: farm._id, zone_id: zone._id, node_id: node._id, severity: 'MEDIUM', title: 't', message: 'm' }
    await Alert.create([
      { ...base, type: 'NODE_OFFLINE', status: 'ACTIVE' },
      { ...base, type: 'SENSOR_FAULT', status: 'ACKNOWLEDGED' },
      { ...base, type: 'NOISE_ANOMALY', status: 'DISMISSED' },
      { ...base, type: 'THRESHOLD_BREACH', status: 'RESOLVED' },
    ])
    const get = (qs: string) => request(app).get(`/alerts?${qs}`).set('Authorization', `Bearer ${token}`)

    const open = await get('open=true').expect(200)
    expect(open.body.data.map((a: { status: string }) => a.status).sort()).toEqual(['ACKNOWLEDGED', 'ACTIVE'])
    expect(open.body.meta).toMatchObject({ total: 2, unreadCount: 1 })
    // status đi kèm thì status thắng
    expect((await get('open=true&status=RESOLVED').expect(200)).body.meta.total).toBe(1)
    expect((await get('').expect(200)).body.meta.total).toBe(4)
    await get('open=false').expect(422)
  })
})

describe('lọc GET /alerts theo nhà gồm cả cảnh báo của các Zone trong nhà (ALERT-FR-007)', () => {
  it('houseId trả cảnh báo cả nhà (camera) và cảnh báo của Zone thuộc nhà, không lẫn nhà khác', async () => {
    const { farm, zone, node, token } = await seed()
    const otherHouse = await House.create({ farm_id: farm._id, name: 'Nhà khác' })
    const otherZone = await Zone.create({ house_id: otherHouse._id, name: 'Tầng khác' })
    const base = { farm_id: farm._id, severity: 'MEDIUM', title: 't', message: 'm' }
    await Alert.create([
      { ...base, zone_id: zone._id, node_id: node._id, type: 'SENSOR_FAULT' },
      { ...base, house_id: zone.house_id, type: 'EDGE_AI_DEGRADED' },
      { ...base, zone_id: otherZone._id, type: 'SENSOR_FAULT' },
    ])
    const res = await request(app).get(`/alerts?houseId=${zone.house_id}`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data.map((a: { type: string }) => a.type).sort()).toEqual(['EDGE_AI_DEGRADED', 'SENSOR_FAULT'])
  })
})

describe('lọc theo nhà vẫn trong phạm vi của Farm Technician (AUTH-FR-013, ALERT-FR-007)', () => {
  it('thợ được giao nhà A: houseId của A trả cảnh báo cả nhà và của Zone; houseId của nhà B không trả gì', async () => {
    const { farm, zone, node } = await seed()
    const technician = await User.create({ email: `tech${String(farm._id)}@test.vn`, password_hash: 'password123', full_name: 'T', role: 'FARM_TECHNICIAN' })
    await Farm.updateOne({ _id: farm._id }, { $push: { members: { user_id: technician._id, role: 'FARM_TECHNICIAN' } } })
    await House.updateOne({ _id: zone.house_id }, { $set: { technicians: [{ user_id: technician._id, primary: true }] } })
    const otherHouse = await House.create({ farm_id: farm._id, name: 'Nhà B' })
    const otherZone = await Zone.create({ house_id: otherHouse._id, name: 'Tầng B' })
    const base = { farm_id: farm._id, severity: 'MEDIUM', title: 't', message: 'm' }
    await Alert.create([
      { ...base, zone_id: zone._id, node_id: node._id, type: 'SENSOR_FAULT' },
      { ...base, house_id: zone.house_id, type: 'EDGE_AI_DEGRADED' },
      { ...base, zone_id: otherZone._id, type: 'SENSOR_FAULT' },
      { ...base, house_id: otherHouse._id, type: 'EDGE_AI_DEGRADED' },
    ])
    const token = jwt.sign({ sub: String(technician._id), role: 'FARM_TECHNICIAN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
    const get = (houseId: unknown) => request(app).get(`/alerts?houseId=${houseId}`).set('Authorization', `Bearer ${token}`).expect(200)
    expect((await get(zone.house_id)).body.data.map((a: { type: string }) => a.type).sort()).toEqual(['EDGE_AI_DEGRADED', 'SENSOR_FAULT'])
    expect((await get(otherHouse._id)).body.data).toHaveLength(0)
  })
})

describe('mức độ và loại cảnh báo: cảnh báo suy luận không lên HIGH, loại lạ bị từ chối', () => {
  it('thiết bị không đẩy được cảnh báo suy luận lên HIGH: mức gửi kèm bị bỏ qua (BR-15)', async () => {
    const { node } = await seed()
    await ingestDeviceAlert({ deviceId: node.device_id, type: 'NOISE_ANOMALY', severity: 'CRITICAL', message: 'ồn' })
    expect((await Alert.findOne().lean())!.severity).toBe('MEDIUM')
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
    // chi tiết theo ERD (metadata giữ cho client cũ)
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

describe('mức của cảnh báo chỉ theo loại (ALERT-FR-001, BR-15)', () => {
  // Chép tay bảng mức: đổi bảng trong code mà không đổi ở đây thì test này đỏ
  const BR15: Record<string, string> = {
    RS485_BUS_FAILURE: 'CRITICAL',
    UNEXPECTED_RESTART: 'HIGH', SPEAKER_FAILURE: 'HIGH', NODE_OFFLINE: 'HIGH', ACTUATOR_FAULT: 'HIGH',
    THRESHOLD_BREACH: 'MEDIUM', CONFIG_MISMATCH: 'MEDIUM', NOISE_ANOMALY: 'MEDIUM', SENSOR_FAULT: 'MEDIUM',
    SENSOR_ANOMALY: 'MEDIUM', MISTING_INEFFECTIVE: 'MEDIUM', EDGE_AI_DEGRADED: 'MEDIUM',
    LOW_RETURN_RATE: 'LOW', FORECAST_BREACH: 'LOW', MAINTENANCE_DUE: 'LOW',
  }

  it('mỗi loại được lưu đúng mức của BR-15', async () => {
    const { farm, zone, node } = await seed()
    for (const type of Object.keys(BR15)) {
      await createAlert({
        farmId: String(farm._id), zoneId: String(zone._id), nodeId: String(node._id),
        type: type as never, title: type, message: 'x',
      })
    }
    const stored = await Alert.find().select('type severity').lean()
    expect(stored).toHaveLength(Object.keys(BR15).length)
    for (const alert of stored) expect([alert.type, alert.severity]).toEqual([alert.type, BR15[alert.type]])
  })
})

describe('mỗi sự cố chỉ một cảnh báo còn mở, kể cả khi tin tới cùng lúc (ALERT-FR-008)', () => {
  it('chỉ mục duy nhất chặn bản thứ hai còn mở của cùng sự cố; sự cố đã đóng thì tạo lại được', async () => {
    const { farm, zone, node } = await seed()
    await Alert.init()
    const doc = {
      farm_id: farm._id, zone_id: zone._id, node_id: node._id, type: 'SENSOR_FAULT', severity: 'MEDIUM', title: 't', message: 'm',
    }
    const first = await Alert.create(doc)
    await expect(Alert.create(doc)).rejects.toMatchObject({ code: 11000 })
    await Alert.updateOne({ _id: first._id }, { status: 'RESOLVED', resolved_at: new Date() })
    await expect(Alert.create(doc)).resolves.toBeDefined()
  })

  it('hai tin cùng sự cố tới cùng lúc chỉ ra một cảnh báo, tin kia được gộp vào', async () => {
    const { node } = await seed()
    await Alert.init()
    const results = await Promise.all([1, 2, 3].map(() =>
      ingestDeviceAlert({ deviceId: node.device_id, type: 'SENSOR_FAULT', message: 'timeout' })))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await Alert.countDocuments({ type: 'SENSOR_FAULT' })).toBe(1)
  })

  it('bơm và quạt hỏng trên cùng controller vẫn là hai sự cố (THREAT-FR-014)', async () => {
    const { farm, zone, node } = await seed()
    const fault = (load: string) => createAlert({
      farmId: String(farm._id), zoneId: String(zone._id), nodeId: String(node._id),
      type: 'ACTUATOR_FAULT', title: load, message: 'x', details: { load },
    })
    expect(await fault('misting')).not.toBeNull()
    expect(await fault('ventilation')).not.toBeNull()
    expect(await fault('misting')).toBeNull()
  })
})
