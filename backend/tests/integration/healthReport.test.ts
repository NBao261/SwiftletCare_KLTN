/**
 * EXPERT-FR-005/006/007 (SRS v2.0.0) — báo cáo sức khỏe Zone do hệ thống tự tổng hợp,
 * Domain Expert viết kết luận, Farm Owner được báo và đọc.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import healthReportRoutes from '@/routes/healthReports.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { RelayOverrideLog } from '@/models/relayOverrideLog.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { ZoneHealthReport } from '@/models/zoneHealthReport.model'
import { buildZoneMetrics, generateWeeklyReports } from '@/services/healthReport.service'
import { notifyUser } from '@/services/notification.service'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitAlertNew: jest.fn(), emitRelayUpdate: jest.fn(), emitTelemetryUpdate: jest.fn(), emitDeviceStatusChange: jest.fn() }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'), // findRecipients thật: chọn người nhận báo cáo
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/health-reports', healthReportRoutes)
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
  await Promise.all([
    Alert, AuditLog, SensorNode, Farm, House, Zone, RelayOverrideLog, Telemetry, User, ZoneHealthReport,
  ].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const call = (method: 'get' | 'put', path: string, token: string, body: object = {}) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

const HOUR = 3600_000
let seq = 0
const mkUser = (role: Role) => User.create({ email: `u${++seq}@test.vn`, password_hash: 'password123', full_name: `U${seq}`, role })

/** Farm có 1 Zone với 10 mẫu telemetry trong 7 ngày qua, 3 cảnh báo và 1 lần can thiệp tay dài ~16,8 giờ */
async function seed(withData = true) {
  const owner = await mkUser('FARM_OWNER')
  const expert = await mkUser('DOMAIN_EXPERT')
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Zone A' }) // ngưỡng mặc định: ẩm 75–95, nhiệt 26–31
  const node = await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const now = Date.now()

  if (withData) {
    // Độ ẩm: 8/10 mẫu trong ngưỡng; nhiệt độ: 9/10; phun sương đổi trạng thái 3 lần; quạt 1 lần
    const humidity = [80, 82, 85, 70, 88, 90, 72, 84, 86, 81]
    const temperature = [28, 28, 29, 30, 33, 29, 28, 28, 27, 28]
    const mistingOn = [false, true, true, false, false, true, true, true, true, true]
    await Telemetry.insertMany(humidity.map((h, i) => ({
      node_id: node._id, zone_id: zone._id, timestamp: new Date(now - (10 - i) * HOUR),
      humidity: h, temperature: temperature[i], nh3_ppm: 4 + i, co2_ppm: 700 + i * 20,
      misting_pct: mistingOn[i] ? 60 : 0, ventilation_pct: 0, misting_on: mistingOn[i], ventilation_on: i === 9,
    })))
    const alert = (type: string) => ({ farm_id: farm._id, zone_id: zone._id, node_id: node._id, type, severity: 'MEDIUM', title: 't', message: 'm', created_at: new Date(now - 5 * 60_000) }) // trước mốc kỳ (làm tròn xuống phút)
    await Alert.create([alert('MISTING_INEFFECTIVE'), alert('NOISE_ANOMALY')])
    await Alert.create({ ...alert('MISTING_INEFFECTIVE'), status: 'RESOLVED' }) // cùng loại, đã đóng — vẫn tính là đã phát sinh trong kỳ
    await RelayOverrideLog.create({
      node_id: node._id, zone_id: zone._id, farm_id: farm._id, relay: 'misting', state: true,
      started_by: owner._id, started_by_role: 'FARM_OWNER',
      started_at: new Date(now - 20 * HOUR), expires_at: new Date(now - 19 * HOUR),
      ended_at: new Date(now - 20 * HOUR + 16.8 * HOUR), end_reason: 'CLEARED_EARLY',
    })
  }
  return { owner, expert, farm, zone, node, t: { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') } }
}

describe('tổng hợp báo cáo (EXPERT-FR-005/007)', () => {
  it('tạo 1 báo cáo / Zone có dữ liệu với đủ số liệu, báo cho Farm Owner và Domain Expert, chạy lại không tạo trùng', async () => {
    const { owner, expert, zone } = await seed()
    await seed(false) // Zone chưa có telemetry → bỏ qua

    expect(await generateWeeklyReports()).toBe(1)
    const report = (await ZoneHealthReport.findOne().lean())!
    expect(String(report.zone_id)).toBe(String(zone._id))
    expect(report.period_end.getTime() - report.period_start.getTime()).toBe(7 * 24 * HOUR)
    expect(report.metrics).toMatchObject({
      sample_count: 10,
      humidity_in_range_pct: 80,
      temp_in_range_pct: 90,
      auto_mode_pct: 90, // 16,8 giờ can thiệp tay trên 168 giờ
      misting_switches: 3,
      ventilation_switches: 1,
      alerts_by_type: { MISTING_INEFFECTIVE: 2, NOISE_ANOMALY: 1 },
      avg_return_rate: null, // chưa có dữ liệu đếm chim
      nh3_avg: 8.5, nh3_max: 13,
      co2_avg: 790, co2_max: 880,
    })

    const notified = (notifyUser as jest.Mock).mock.calls.map(c => c[0])
    expect(notified.sort()).toEqual([String(owner._id), String(expert._id)].sort())

    expect(await generateWeeklyReports()).toBe(0)
    expect(await ZoneHealthReport.countDocuments()).toBe(1)
  })
})

describe('hai lần chạy chồng nhau không tạo báo cáo trùng', () => {
  it('cùng một nhịp cron trên 2 instance: chỉ 1 báo cáo và 1 lượt thông báo', async () => {
    await ZoneHealthReport.init() // chờ unique index tạo xong
    await seed()
    const tick = new Date()

    const [a, b] = await Promise.all([generateWeeklyReports(tick), generateWeeklyReports(new Date(tick.getTime() + 500))])
    expect(a + b).toBe(1)
    expect(await ZoneHealthReport.countDocuments()).toBe(1)
    expect((notifyUser as jest.Mock).mock.calls).toHaveLength(2) // chủ farm + chuyên gia, đúng 1 lượt
  })
})

describe('một Zone lỗi không làm các Zone khác mất báo cáo', () => {
  it('Zone đầu ném lỗi lúc tổng hợp, Zone sau vẫn có báo cáo', async () => {
    await seed()
    await seed()
    jest.spyOn(ZoneHealthReport, 'exists').mockRejectedValueOnce(new Error('aggregate quá tải') as never)

    expect(await generateWeeklyReports()).toBe(1)
    expect(await ZoneHealthReport.countDocuments()).toBe(1)
    jest.restoreAllMocks()
  })
})

describe('số lần đóng cắt relay không bị phồng sau khi mất mạng', () => {
  it('mẫu xả từ bộ đệm offline (không có trạng thái relay) không được tính là một lần đổi', async () => {
    const { zone, node } = await seed(false)
    const now = Date.now()
    // bật, bật, [2 mẫu offline không có misting_on], bật, tắt → đúng 1 lần đổi (bật → tắt)
    const rows: Array<boolean | undefined> = [true, true, undefined, undefined, true, false]
    await Telemetry.insertMany(rows.map((on, i) => ({
      node_id: node._id, zone_id: zone._id, timestamp: new Date(now - (rows.length - i) * 60_000), humidity: 80, temperature: 28,
      ...(on === undefined ? {} : { misting_on: on, ventilation_on: false }),
    })))

    const metrics = await buildZoneMetrics((await Zone.findById(zone._id))!, new Date(now - HOUR), new Date(now))
    expect(metrics).toMatchObject({ sample_count: 6, misting_switches: 1, ventilation_switches: 0 })
  })
})

describe('đọc báo cáo', () => {
  it('Farm Owner và Domain Expert xem danh sách, chi tiết và khoảng bất kỳ; farm khác thì 403', async () => {
    const { zone, t } = await seed()
    await generateWeeklyReports()
    const id = String((await ZoneHealthReport.findOne())!._id)

    const list = await call('get', `/health-reports?zoneId=${zone._id}`, t.expert).expect(200)
    expect(list.body.meta.total).toBe(1)
    expect((await call('get', `/health-reports/${id}`, t.owner).expect(200)).body.data.metrics.sample_count).toBe(10)

    const from = new Date(Date.now() - 5.5 * HOUR).toISOString() // chỉ 5 mẫu cuối
    const preview = await call('get', `/health-reports/preview?zoneId=${zone._id}&from=${from}`, t.owner).expect(200)
    expect(preview.body.data.metrics).toMatchObject({ sample_count: 5, humidity_in_range_pct: 80 })
    expect(await ZoneHealthReport.countDocuments()).toBe(1) // preview không lưu

    // `to` ở tương lai bị kẹp về hiện tại
    const future = new Date(Date.now() + 24 * HOUR).toISOString()
    const clamped = await call('get', `/health-reports/preview?zoneId=${zone._id}&from=${from}&to=${future}`, t.owner).expect(200)
    expect(new Date(clamped.body.data.period_end).getTime()).toBeLessThanOrEqual(Date.now())

    const tooLong = new Date(Date.now() - 200 * 24 * HOUR).toISOString()
    await call('get', `/health-reports/preview?zoneId=${zone._id}&from=${tooLong}`, t.owner).expect(400)

    const other = await seed()
    await call('get', `/health-reports?zoneId=${zone._id}`, other.t.owner).expect(403)
    await call('get', `/health-reports/${id}`, other.t.expert).expect(403)
  })
})

describe('kết luận của chuyên gia (EXPERT-FR-006)', () => {
  it('chỉ Domain Expert viết; Farm Owner được báo; người viết sửa được, chuyên gia khác thì không', async () => {
    const { owner, expert, farm, t } = await seed()
    await generateWeeklyReports()
    const id = String((await ZoneHealthReport.findOne())!._id)
    jest.clearAllMocks()

    await call('put', `/health-reports/${id}/conclusion`, t.owner, { text: 'x' }).expect(403)
    await call('put', `/health-reports/${id}/conclusion`, t.expert, { text: '  ' }).expect(422)

    const res = await call('put', `/health-reports/${id}/conclusion`, t.expert, { text: 'Độ ẩm ổn; nên giảm biên độ ồn xuống 12 dB.' }).expect(200)
    // PUT trả cùng hình dạng với GET: `by` là {_id, full_name}
    expect(res.body.data.expert_conclusion).toMatchObject({
      text: 'Độ ẩm ổn; nên giảm biên độ ồn xuống 12 dB.', by: { _id: String(expert._id), full_name: expert.full_name },
    })
    expect((notifyUser as jest.Mock).mock.calls.map(c => c[0])).toEqual([String(owner._id)])
    expect(await AuditLog.countDocuments({ action: 'HEALTH_REPORT_CONCLUDED' })).toBe(1)

    // Farm Owner đọc được kết luận kèm tên chuyên gia
    const read = await call('get', `/health-reports/${id}`, t.owner).expect(200)
    expect(read.body.data.expert_conclusion.by.full_name).toBe(expert.full_name)

    const firstAt = res.body.data.expert_conclusion.at
    expect(res.body.data.expert_conclusion.edited_at).toBeUndefined()
    const edited = await call('put', `/health-reports/${id}/conclusion`, t.expert, { text: 'Bản sửa.' }).expect(200)
    // EXPERT-FR-006 — lưu thời điểm sửa, giữ lúc viết lần đầu
    expect(edited.body.data.expert_conclusion.at).toBe(firstAt)
    expect(edited.body.data.expert_conclusion.edited_at).toEqual(expect.any(String))
    // EXPERT-FR-009 — kết luận vào lịch sử hoạt động của farm
    expect(await AuditLog.countDocuments({ action: 'HEALTH_REPORT_CONCLUDED', farm_id: farm._id })).toBe(2)
    const second = await mkUser('DOMAIN_EXPERT')
    await Farm.updateOne({ _id: farm._id }, { $push: { members: { user_id: second._id, role: 'DOMAIN_EXPERT' } } })
    await call('put', `/health-reports/${id}/conclusion`, tokenFor(second._id, 'DOMAIN_EXPERT'), { text: 'Ghi đè' }).expect(403)
    expect((await ZoneHealthReport.findById(id).lean())!.expert_conclusion!.text).toBe('Bản sửa.')
  })
})
