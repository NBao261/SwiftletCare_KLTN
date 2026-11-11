/**
 * EXPERT-FR-005, 006, 013, BR-31, BR-33, SM-09 — báo cáo sức khỏe theo nhà: ngày, tuần, tháng (TC-ST 6.9),
 * theo yêu cầu, mỗi Zone một mục; trạng thái ngày che theo người gọi; kết luận của chuyên gia; xem báo cáo
 * (TC-F21-01). Báo cáo tuần theo Zone cũ vẫn chạy song song.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose, { Types } from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import healthReportRoutes from '@/routes/healthReports.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { HouseHealthReport } from '@/models/houseHealthReport.model'
import { House } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { ZoneHealthReport } from '@/models/zoneHealthReport.model'
import { vnDate } from '@/services/birdCount.service'
import { addDays, vnDayStart } from '@/services/healthAssessment.service'
import {
  generateDailyReports, generateHouseReport, generateMonthlyHouseReports, generateWeeklyHouseReports,
} from '@/services/houseHealthReport.service'
import { notifyUser } from '@/services/notification.service'
import type { HealthStatus, Role } from '@/types'
import { HEALTH_MODELS, seedCounts, seedHouse, seedTelemetry } from '../helpers/healthDay'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
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
  await HouseHealthReport.init() // index unique nhà + loại + kỳ
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
afterEach(async () => {
  jest.clearAllMocks()
  await Promise.all([...HEALTH_MODELS, AuditLog, HouseHealthReport, ZoneHealthReport].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const call = (method: 'get' | 'post' | 'put', path: string, token: string, body: object = {}) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

const TODAY = vnDate(new Date())
const DAY = addDays(TODAY, -3)
/** 06:30 giờ VN thứ Hai 02/11/2026 và ngày 01/11/2026 */
const MONDAY_0630 = new Date('2026-11-01T23:30:00Z')
const FIRST_0630 = new Date('2026-10-31T23:30:00Z')

async function setup() {
  const seeded = await seedHouse()
  return { ...seeded, ownerToken: tokenFor(seeded.owner._id, 'FARM_OWNER'), expertToken: tokenFor(seeded.expert!._id, 'DOMAIN_EXPERT') }
}

const mkDay = (house: { _id: unknown; farm_id: unknown }, date: string, status: HealthStatus) =>
  HouseHealthDay.create({
    house_id: house._id, farm_id: house.farm_id, date,
    indicators: {
      environment: { value: 95, level: 'NORMAL' }, air: { value: 0, level: 'NORMAL' },
      flock: { value: 0, level: 'NORMAL' }, noise: { value: 0, level: 'NORMAL' },
    },
    completeness: { environment: true, air: true, flock: true, noise: true },
    current_status: status, current_reasons: [{ code: 'ALL_NORMAL', source: null, level: null, values: {} }],
    evidence: { noise_alert_ids: [] }, computed_at: new Date(), ratings: [],
  })

describe('TC-ST 6.9 — job sinh báo cáo theo nhà (BR-33)', () => {
  it('báo cáo ngày: 1 bản mỗi nhà, mỗi Zone một mục; chạy lại không trùng; không gửi thông báo riêng', async () => {
    const { house, zone } = await setup()
    await seedTelemetry(zone, DAY, { slots: 100 })

    expect(await generateDailyReports(DAY)).toBe(1)
    expect(await generateDailyReports(DAY)).toBe(0)
    const reports = await HouseHealthReport.find({ house_id: house._id }).lean()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ kind: 'DAILY', period_start: DAY, period_end: DAY })
    expect(reports[0].zone_sections).toHaveLength(1)
    expect(reports[0].zone_sections[0]).toMatchObject({ zone_name: 'Tầng 1', sample_count: 100 })
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('báo cáo ngày hôm qua đã có thì được tính lại cho đủ cả ngày', async () => {
    const { house } = await setup()
    const yesterday = addDays(DAY, -1)
    await generateHouseReport('DAILY', String(house._id), yesterday, yesterday, new Date(0))
    await generateDailyReports(DAY)
    const refreshed = await HouseHealthReport.findOne({ house_id: house._id, period_start: yesterday }).lean()
    expect(refreshed!.generated_at.getTime()).toBeGreaterThan(0)
  })

  it('tuần: thứ Hai tới Chủ nhật tuần trước; tháng: trọn tháng trước; thông báo không kèm trạng thái', async () => {
    const { house, owner, expert } = await setup()
    expect(await generateWeeklyHouseReports(MONDAY_0630)).toBe(1)
    expect(await generateMonthlyHouseReports(FIRST_0630)).toBe(1)
    const kinds = await HouseHealthReport.find({ house_id: house._id }).sort({ kind: 1 }).lean()
    expect(kinds.map(r => [r.kind, r.period_start, r.period_end])).toEqual([
      ['MONTHLY', '2026-10-01', '2026-10-31'],
      ['WEEKLY', '2026-10-26', '2026-11-01'],
    ])

    const notified = jest.mocked(notifyUser).mock.calls
    expect(notified.map(c => c[0]).sort()).toEqual([String(owner._id), String(expert!._id), String(owner._id), String(expert!._id)].sort())
    for (const [, payload] of notified) {
      expect(payload.ref).toMatchObject({ kind: 'health_report' })
      expect(`${payload.title} ${payload.body}`).not.toMatch(/GOOD|WATCH|ACTION|Tốt|Theo dõi|Cần xử lý/)
    }
    // Chạy lại cùng kỳ: không tạo thêm, không báo lại
    expect(await generateWeeklyHouseReports(MONDAY_0630)).toBe(0)
  })
})

describe('số liệu của báo cáo (EXPERT-FR-005)', () => {
  it('% trong ngưỡng của Zone, tỷ lệ chim về có ngày thiếu phiên, cảnh báo suy luận theo kết luận, lỗi thiết bị, ngày mưa', async () => {
    const { farm, house, zone, expert } = await setup()
    await seedTelemetry(zone, DAY, { slots: 100, humidityOutSlots: 20 })
    await seedCounts(house, DAY, [100, 80, null])
    const at = new Date(vnDayStart(DAY).getTime() + 10 * 3600_000)
    const verdict = (result: string) => ({ result, by: expert!._id, role: 'DOMAIN_EXPERT', at })
    await Alert.create([
      { farm_id: farm._id, zone_id: zone._id, type: 'SENSOR_ANOMALY', severity: 'MEDIUM', title: 'a', message: 'a', created_at: at, expert_verdict: verdict('CONFIRMED') },
      { farm_id: farm._id, zone_id: zone._id, type: 'NOISE_ANOMALY', severity: 'MEDIUM', title: 'b', message: 'b', status: 'DISMISSED', created_at: at, expert_verdict: verdict('REJECTED') },
      { farm_id: farm._id, zone_id: zone._id, type: 'FORECAST_BREACH', severity: 'LOW', title: 'c', message: 'c', created_at: at },
      { farm_id: farm._id, zone_id: zone._id, type: 'SENSOR_FAULT', severity: 'MEDIUM', title: 'd', message: 'd', created_at: at },
    ])
    await WeatherObservation.create([
      { farm_id: farm._id, hour: at, temperature: 30, humidity: 70, precipitation_mm: 2 },
      { farm_id: farm._id, hour: new Date(at.getTime() + 3600_000), temperature: 25, humidity: 90, precipitation_mm: 0.5 },
    ])

    const { report } = (await generateHouseReport('CUSTOM', String(house._id), addDays(DAY, -2), DAY))!
    expect(report.zone_sections[0]).toMatchObject({
      humidity_in_range_pct: 80,
      inferred_alerts: { confirmed: 1, dismissed: 1, pending: 1 },
      device_faults: { SENSOR_FAULT: 1 },
    })
    expect(report.house_metrics.return_rate_trend).toEqual([
      { date: addDays(DAY, -2), return_rate: 100, complete: true },
      { date: addDays(DAY, -1), return_rate: 80, complete: true },
      { date: DAY, return_rate: null, complete: false },
    ])
    expect(report.house_metrics.avg_return_rate).toBe(90)
    expect(report.house_metrics.weather).toMatchObject({ temperature_min: 25, temperature_max: 30, precipitation_mm: 2.5, rain_days: 1 })
  })
})

describe('BR-31 — báo cáo che ngày người gọi chưa chấm', () => {
  it('ngày chưa chấm không có trạng thái, lý do, điểm, tỷ lệ chim về; status_counts bỏ ngày đó; chấm xong thì hiện', async () => {
    const { farm, house, ownerToken, expertToken } = await setup()
    await seedCounts(house, DAY, [90, 70])
    // Người chấm thứ hai là chủ đồng sở hữu (BR-31, Report 3 4.2.0: chuyên gia không chấm)
    const coOwner = await User.create({ email: 'co-report@t.vn', password_hash: 'password123', full_name: 'Đồng chủ', role: 'FARM_OWNER' })
    await Farm.updateOne({ _id: farm._id }, { $push: { members: { user_id: coOwner._id, role: 'FARM_OWNER' } } })
    const coOwnerToken = tokenFor(coOwner._id, 'FARM_OWNER')
    const shown = await mkDay(house, addDays(DAY, -1), 'WATCH')
    const hidden = await mkDay(house, DAY, 'ACTION')
    await call('post', `/health-reports/days/${shown._id}/rating`, ownerToken, { rating: 'GOOD' }).expect(201)
    await call('post', `/health-reports/days/${hidden._id}/rating`, coOwnerToken, { rating: 'ACTION' }).expect(201)
    // Chuyên gia không phải người chấm: báo cáo không che ngày nào với chuyên gia
    const expertView = await call('get', `/health-reports/${(await generateHouseReport('CUSTOM', String(house._id), addDays(DAY, -1), DAY))!.report._id}`, expertToken).expect(200)
    expect(expertView.body.data).toMatchObject({ status_counts: { WATCH: 1, ACTION: 1 }, hidden_days: 0 })
    expect(expertView.body.data.house_metrics).toMatchObject({
      return_rate_trend: [{ date: addDays(DAY, -1), return_rate: 90 }, { date: DAY, return_rate: 70 }], avg_return_rate: 80,
    })
    const { report } = (await generateHouseReport('CUSTOM', String(house._id), addDays(DAY, -1), DAY))!

    const res = await call('get', `/health-reports/${report._id}`, ownerToken).expect(200)
    const days = res.body.data.days as { _id: string; current_status?: string; current_reasons?: unknown; ratings?: unknown }[]
    const pending = days.find(d => d._id === String(hidden._id))!
    expect(pending).not.toHaveProperty('current_status')
    expect(pending).not.toHaveProperty('current_reasons')
    expect(pending).not.toHaveProperty('ratings')
    expect(res.body.data).toMatchObject({ status_counts: { WATCH: 1, ACTION: 0 }, hidden_days: 1 })
    // Tỷ lệ chim về của ngày chưa chấm cũng che, trung bình chỉ còn ngày đã thấy (BR-31)
    expect(res.body.data.house_metrics).toMatchObject({
      return_rate_trend: [{ date: addDays(DAY, -1), return_rate: 90 }, { date: DAY, return_rate: null, complete: true }], avg_return_rate: 90,
    })

    await call('post', `/health-reports/days/${hidden._id}/rating`, ownerToken, { rating: 'ACTION' }).expect(201)
    const after = await call('get', `/health-reports/${report._id}`, ownerToken).expect(200)
    expect(after.body.data).toMatchObject({ status_counts: { WATCH: 1, ACTION: 1 }, hidden_days: 0 })
    expect(after.body.data.house_metrics).toMatchObject({ return_rate_trend: [{ return_rate: 90 }, { return_rate: 70 }], avg_return_rate: 80 })
    // Dữ liệu lưu không bị che
    expect((await HouseHealthReport.findById(report._id).lean())!.house_metrics.avg_return_rate).toBe(80)
  })
})

describe('POST /health-reports — báo cáo theo yêu cầu (tối đa 31 ngày)', () => {
  it('201 khi mới; cùng khoảng → 200, không tạo bản thứ hai; quá 31 ngày, to ở tương lai, from sau to → 400', async () => {
    const { house, ownerToken } = await setup()
    const body = { houseId: String(house._id), from: addDays(DAY, -6), to: DAY }
    const first = await call('post', '/health-reports', ownerToken, body).expect(201)
    expect(first.body.data).toMatchObject({ kind: 'CUSTOM', period_start: body.from, period_end: body.to, hidden_days: 0 })
    const again = await call('post', '/health-reports', ownerToken, body).expect(200)
    expect(again.body.data._id).toBe(first.body.data._id)
    expect(await HouseHealthReport.countDocuments({ kind: 'CUSTOM' })).toBe(1)

    await call('post', '/health-reports', ownerToken, { ...body, from: addDays(DAY, -31) }).expect(400)
    await call('post', '/health-reports', ownerToken, { ...body, to: addDays(TODAY, 1) }).expect(400)
    await call('post', '/health-reports', ownerToken, { ...body, from: addDays(DAY, 1) }).expect(400)
    await call('post', '/health-reports', ownerToken, { from: body.from, to: body.to }).expect(422)
  })
})

describe('TC-F21-01 — xem báo cáo theo nhà', () => {
  it('Farm Owner, Domain Expert và thợ được giao nhà xem danh sách và chi tiết; người farm khác, Administrator → 403', async () => {
    const { farm, house, ownerToken, expertToken } = await setup()
    const { report } = (await generateHouseReport('WEEKLY', String(house._id), addDays(DAY, -6), DAY))!

    for (const token of [ownerToken, expertToken]) {
      const list = await call('get', `/health-reports?houseId=${house._id}`, token).expect(200)
      expect(list.body.meta.total).toBe(1)
      expect(list.body.data[0]).toMatchObject({ _id: String(report._id), kind: 'WEEKLY', house_name: house.name, has_conclusion: false })
      expect(list.body.data[0]).not.toHaveProperty('zone_sections')
      const one = await call('get', `/health-reports/${report._id}`, token).expect(200)
      expect(one.body.data.zone_sections).toHaveLength(1)
    }
    expect((await call('get', `/health-reports?farmId=${farm._id}&kind=WEEKLY`, ownerToken).expect(200)).body.meta.total).toBe(1)
    expect((await call('get', `/health-reports?farmId=${farm._id}&kind=MONTHLY`, ownerToken).expect(200)).body.meta.total).toBe(0)
    await call('get', '/health-reports', ownerToken).expect(400)

    const other = await setup()
    await call('get', `/health-reports/${report._id}`, other.ownerToken).expect(403)
    await call('get', `/health-reports?houseId=${house._id}`, other.ownerToken).expect(403)
    // Administrator và thợ không thuộc farm → 403
    for (const role of ['FARM_TECHNICIAN', 'ADMIN'] as const) {
      const user = await User.create({ email: `${role}${Math.random()}@t.vn`, password_hash: 'password123', full_name: role, role })
      await call('get', `/health-reports/${report._id}`, tokenFor(user._id, role)).expect(403)
    }
    // Report 3 §2.4 — thợ được giao nhà đọc báo cáo của nhà đó; lọc theo farm chỉ ra nhà được giao
    const technician = await User.create({ email: `ft${Math.random()}@t.vn`, password_hash: 'password123', full_name: 'Thợ', role: 'FARM_TECHNICIAN' })
    const technicianToken = tokenFor(technician._id, 'FARM_TECHNICIAN')
    await Farm.updateOne({ _id: farm._id }, { $push: { members: { user_id: technician._id, role: 'FARM_TECHNICIAN' } } })
    await call('get', `/health-reports/${report._id}`, technicianToken).expect(403)
    expect((await call('get', `/health-reports?farmId=${farm._id}&kind=WEEKLY`, technicianToken).expect(200)).body.meta.total).toBe(0)
    await House.updateOne({ _id: house._id }, { $push: { technicians: { user_id: technician._id, primary: true } } })
    await call('get', `/health-reports/${report._id}`, technicianToken).expect(200)
    expect((await call('get', `/health-reports?farmId=${farm._id}&kind=WEEKLY`, technicianToken).expect(200)).body.meta.total).toBe(1)
  })
})

describe('kết luận của chuyên gia (EXPERT-FR-006, SM-09)', () => {
  it('GENERATED → CONCLUDED, Farm Owner được báo; tác giả sửa thì lưu edited_at; chuyên gia khác và Farm Owner → 403', async () => {
    const { farm, house, owner, ownerToken, expertToken } = await setup()
    const { report } = (await generateHouseReport('WEEKLY', String(house._id), addDays(DAY, -6), DAY))!

    const done = await call('put', `/health-reports/${report._id}/conclusion`, expertToken, { text: 'Đàn ổn định' }).expect(200)
    expect(done.body.data).toMatchObject({ has_conclusion: true, expert_conclusion: { text: 'Đàn ổn định' } })
    expect(done.body.data.expert_conclusion).not.toHaveProperty('edited_at')
    expect(jest.mocked(notifyUser).mock.calls.some(c => c[0] === String(owner._id) && c[1].ref?.kind === 'health_report')).toBe(true)
    expect(await AuditLog.exists({ action: 'HEALTH_REPORT_CONCLUDED', 'metadata.house_id': String(house._id) })).toBeTruthy()

    const edited = await call('put', `/health-reports/${report._id}/conclusion`, expertToken, { text: 'Theo dõi thêm NH3' }).expect(200)
    expect(edited.body.data.expert_conclusion.edited_at).toBeTruthy()

    const second = await User.create({ email: `e2${Math.random()}@t.vn`, password_hash: 'password123', full_name: 'CG 2', role: 'DOMAIN_EXPERT' })
    await Farm.updateOne({ _id: farm._id }, { $push: { members: { user_id: second._id, role: 'DOMAIN_EXPERT' } } })
    await call('put', `/health-reports/${report._id}/conclusion`, tokenFor(second._id, 'DOMAIN_EXPERT'), { text: 'x' }).expect(403)
    await call('put', `/health-reports/${report._id}/conclusion`, ownerToken, { text: 'x' }).expect(403)
  })
})

describe('báo cáo tuần theo Zone cũ vẫn chạy (deprecated)', () => {
  it('?zoneId trả ZoneHealthReport; id báo cáo Zone mở được và viết kết luận được', async () => {
    const { farm, zone, ownerToken, expertToken } = await setup()
    const old = await ZoneHealthReport.create({
      farm_id: farm._id, zone_id: zone._id, period_start: new Date(Date.now() - 7 * 86_400_000), period_end: new Date(),
      metrics: { sample_count: 1 },
    })
    const list = await call('get', `/health-reports?zoneId=${zone._id}`, ownerToken).expect(200)
    expect(list.body.data[0]).toMatchObject({ _id: String(old._id), zone_id: String(zone._id) })
    const one = await call('get', `/health-reports/${old._id}`, ownerToken).expect(200)
    expect(one.body.data).toMatchObject({ zone_id: String(zone._id) })
    await call('put', `/health-reports/${old._id}/conclusion`, expertToken, { text: 'ok' }).expect(200)
    await call('get', `/health-reports/${new Types.ObjectId()}`, ownerToken).expect(404)
  })
})
