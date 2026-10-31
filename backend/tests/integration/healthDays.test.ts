/**
 * EXPERT-FR-012/013, BR-31, SM-18, ANALYTICS-FR-014 — chấm độc lập trạng thái ngày (TC-F22-01…03,
 * TC-ST §6.18), CSV (TC-F21-02), mức chỉ số theo nhà (ANALYTICS-FR-012, BR-22), độ khớp.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose, { Types } from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import farmRoutes from '@/routes/farms.route'
import healthReportRoutes from '@/routes/healthReports.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { vnDate } from '@/services/birdCount.service'
import { addDays, assessHouseDay } from '@/services/healthAssessment.service'
import { DEFAULT_HEALTH_LEVELS } from '@/utils/detectionTuning.util'
import type { HealthStatus, Role } from '@/types'
import { HEALTH_MODELS, seedCounts, seedDryWeather, seedHouse, seedTelemetry } from '../helpers/healthDay'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
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
  await Promise.all([...HEALTH_MODELS, AuditLog].map(m => (m as typeof House).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const call = (method: 'get' | 'post' | 'put' | 'patch', path: string, token: string, body: object = {}) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

const TODAY = vnDate(new Date())
const YESTERDAY = addDays(TODAY, -1)
const levels = { environment: 'NORMAL', air: 'NORMAL', flock: 'CLEAR', noise: 'SLIGHT' }

/** Ngày đã đánh giá (ghi thẳng — phần tính đã có ở healthAssessment.test.ts) */
const mkDay = (house: { _id: unknown; farm_id: unknown }, date: string, status: HealthStatus = 'ACTION', extra: object = {}) =>
  HouseHealthDay.create({
    house_id: house._id, farm_id: house.farm_id, date,
    indicators: {
      environment: { value: 95, level: levels.environment }, air: { value: 0, level: levels.air },
      flock: { value: 30, level: levels.flock, details: { return_rate: 70 } }, noise: { value: 1, level: levels.noise },
    },
    completeness: { environment: true, air: true, flock: true, noise: true },
    current_status: status, current_reasons: [`Lý do của ${status}`],
    evidence: { noise_alert_ids: [new Types.ObjectId()] },
    computed_at: new Date(), ratings: [], ...extra,
  })

async function setup() {
  const seeded = await seedHouse()
  return {
    ...seeded,
    ownerToken: tokenFor(seeded.owner._id, 'FARM_OWNER'),
    expertToken: tokenFor(seeded.expert!._id, 'DOMAIN_EXPERT'),
  }
}

const HIDDEN = ['current_status', 'current_reasons', 'indicators', 'completeness', 'evidence', 'ratings']

describe('TC-F22-01 — chưa chấm thì mọi kênh che trạng thái (BR-31)', () => {
  it('ngày, danh sách và CSV không có trạng thái, lý do, điểm người khác; chấm xong 201 kèm trạng thái và ảnh chụp', async () => {
    const { house, ownerToken, expertToken } = await setup()
    const day = await mkDay(house, YESTERDAY)
    // Chuyên gia chấm trước — điểm của chuyên gia không được lộ cho chủ trại
    expect((await call('post', `/health-reports/days/${day._id}/rating`, expertToken, { rating: 'WATCH' })).status).toBe(201)

    const one = await call('get', `/health-reports/days/${day._id}`, ownerToken)
    expect(one.status).toBe(200)
    expect(one.body.data.my_rating_state).toBe('PENDING')
    for (const key of HIDDEN) expect(one.body.data).not.toHaveProperty(key)

    const list = await call('get', `/health-reports/days?houseId=${house._id}`, ownerToken)
    expect(list.body.data).toHaveLength(1)
    for (const key of HIDDEN) expect(list.body.data[0]).not.toHaveProperty(key)

    const csv = await call('get', `/health-reports/days.csv?houseId=${house._id}`, ownerToken)
    expect(csv.text).not.toMatch(/Cần xử lý|Theo dõi|Lý do của|CG \d/)

    const rated = await call('post', `/health-reports/days/${day._id}/rating`, ownerToken, { rating: 'GOOD', note: 'Chim về đều' })
    expect(rated.status).toBe(201)
    expect(rated.body.data).toMatchObject({ my_rating_state: 'RATED', current_status: 'ACTION', current_reasons: ['Lý do của ACTION'] })
    expect(rated.body.data.ratings).toHaveLength(2)

    const saved = await HouseHealthDay.findById(day._id).lean()
    const mine = saved!.ratings.find(r => r.role === 'FARM_OWNER')
    expect(mine).toMatchObject({ outcome: 'RATED', rating: 'GOOD', note: 'Chim về đều', snapshot: { status: 'ACTION', reasons: ['Lý do của ACTION'] } })
    expect(mine!.snapshot.levels).toMatchObject(levels)
    expect(await AuditLog.countDocuments({ action: 'HEALTH_DAY_RATED' })).toBe(2)
  })
})

describe('TC-F22-02 — trạng thái hiện tại theo dữ liệu, ảnh chụp không đổi (SM-17, D16)', () => {
  it('số đếm về trễ đổi current_status, snapshot giữ nguyên; chấm lại 409; thêm ghi chú 200', async () => {
    const { farm, house, zone, ownerToken } = await setup()
    await seedTelemetry(zone, YESTERDAY)
    await seedCounts(house, YESTERDAY, [100, 100, 100, 100])
    await seedDryWeather(farm, YESTERDAY)
    const { day } = (await assessHouseDay(String(house._id), YESTERDAY))!
    expect(day.current_status).toBe('GOOD')

    expect((await call('post', `/health-reports/days/${day._id}/rating`, ownerToken, { rating: 'GOOD' })).status).toBe(201)

    // Số đếm phiên chiều về trễ: 100 → 70 % (giảm 30 % → CLEAR) → WATCH
    await BirdCountRecord.updateOne({ house_id: house._id, session_date: YESTERDAY, session_type: 'EVENING_ENTRY' }, { entry_count: 700 })
    await assessHouseDay(String(house._id), YESTERDAY)

    const saved = await HouseHealthDay.findById(day._id).lean()
    expect(saved!.current_status).toBe('WATCH')
    expect(saved!.ratings[0].snapshot.status).toBe('GOOD')

    const again = await call('post', `/health-reports/days/${day._id}/rating`, ownerToken, { rating: 'WATCH' })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('RATING_CLOSED')
    expect((await call('post', `/health-reports/days/${day._id}/skip`, ownerToken)).status).toBe(409)

    const note = await call('patch', `/health-reports/days/${day._id}/rating/note`, ownerToken, { note: 'Chiều mưa' })
    expect(note.status).toBe(200)
    const afterNote = await HouseHealthDay.findById(day._id).lean()
    expect(afterNote!.ratings[0]).toMatchObject({ rating: 'GOOD', note: 'Chiều mưa', snapshot: { status: 'GOOD' } })
  })
})

describe('TC-F22-03 — quyền và hạn chấm', () => {
  it('Technician, Administrator → 403', async () => {
    const { house } = await setup()
    const day = await mkDay(house, YESTERDAY)
    for (const role of ['TECHNICIAN', 'ADMIN'] as Role[]) {
      const user = await User.create({ email: `${role}@t.vn`, password_hash: 'password123', full_name: role, role })
      const res = await call('post', `/health-reports/days/${day._id}/rating`, tokenFor(user._id, role), { rating: 'GOOD' })
      expect(res.status).toBe(403)
    }
  })

  it('ngày cũ 8 ngày → 409 và trạng thái đã hiện (EXPIRED); ngày cũ 7 ngày vẫn chấm được', async () => {
    const { house, ownerToken } = await setup()
    const old = await mkDay(house, addDays(TODAY, -8))
    const res = await call('post', `/health-reports/days/${old._id}/rating`, ownerToken, { rating: 'GOOD' })
    expect(res.status).toBe(409)
    const shown = await call('get', `/health-reports/days/${old._id}`, ownerToken)
    expect(shown.body.data).toMatchObject({ my_rating_state: 'EXPIRED', current_status: 'ACTION' })

    const edge = await mkDay(house, addDays(TODAY, -7))
    expect((await call('post', `/health-reports/days/${edge._id}/rating`, ownerToken, { rating: 'GOOD' })).status).toBe(201)
  })
})

describe('TC-ST §6.18 — trạng thái chấm của từng người', () => {
  it('SKIPPED: hiện trạng thái, không có điểm; chấm sau khi bỏ qua → 409', async () => {
    const { house, ownerToken } = await setup()
    const day = await mkDay(house, YESTERDAY)
    const skipped = await call('post', `/health-reports/days/${day._id}/skip`, ownerToken)
    expect(skipped.status).toBe(201)
    expect(skipped.body.data).toMatchObject({ my_rating_state: 'SKIPPED', current_status: 'ACTION' })
    expect(skipped.body.data.ratings[0]).toMatchObject({ outcome: 'SKIPPED', rating: null })
    expect((await call('post', `/health-reports/days/${day._id}/rating`, ownerToken, { rating: 'GOOD' })).status).toBe(409)
  })

  it('EXPIRED theo từng người: chủ trại đã chấm thì điểm giữ nguyên, chuyên gia chưa chấm thì hết hạn', async () => {
    const { house, owner, expertToken } = await setup()
    const date = addDays(TODAY, -9)
    const day = await mkDay(house, date, 'WATCH', {
      ratings: [{ by: owner._id, role: 'FARM_OWNER', outcome: 'RATED', rating: 'WATCH', at: new Date(), snapshot: { status: 'WATCH', reasons: [] } }],
    })
    const res = await call('get', `/health-reports/days/${day._id}`, expertToken)
    expect(res.body.data.my_rating_state).toBe('EXPIRED')
    expect(res.body.data.ratings).toEqual([expect.objectContaining({ outcome: 'RATED', rating: 'WATCH', role: 'FARM_OWNER' })])
  })

  it('thêm ghi chú khi chưa chấm → 409; người ngoài farm → 403', async () => {
    const { house, ownerToken } = await setup()
    const day = await mkDay(house, YESTERDAY)
    expect((await call('patch', `/health-reports/days/${day._id}/rating/note`, ownerToken, { note: 'x' })).status).toBe(409)
    const other = await seedHouse()
    const outsider = tokenFor(other.owner._id, 'FARM_OWNER')
    expect((await call('get', `/health-reports/days/${day._id}`, outsider)).status).toBe(403)
    expect((await call('get', `/health-reports/days?houseId=${house._id}`, outsider)).status).toBe(403)
  })

  it('rating sai giá trị → 422; khoảng quá 31 ngày → 400', async () => {
    const { house, ownerToken } = await setup()
    const day = await mkDay(house, YESTERDAY)
    expect((await call('post', `/health-reports/days/${day._id}/rating`, ownerToken, { rating: 'INSUFFICIENT_DATA' })).status).toBe(422)
    const res = await call('get', `/health-reports/days?houseId=${house._id}&from=${addDays(TODAY, -40)}&to=${TODAY}`, ownerToken)
    expect(res.status).toBe(400)
  })
})

describe('TC-F21-02 — CSV ngày (EXPERT-FR-013)', () => {
  it('1 dòng mỗi nhà × ngày với mọi chỉ số, mức, trạng thái và điểm; không có id nội bộ', async () => {
    const { farm, house, ownerToken } = await setup()
    const day = await mkDay(house, YESTERDAY)
    await call('post', `/health-reports/days/${day._id}/rating`, ownerToken, { rating: 'WATCH' })

    const res = await call('get', `/health-reports/days.csv?farmId=${farm._id}`, ownerToken)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('Mức môi trường')
    expect(lines[0]).toContain('Điểm của người chấm')
    expect(lines[1]).toContain(house.name)
    expect(lines[1]).toContain('Cần xử lý')
    expect(lines[1]).toContain('Theo dõi')
    expect(lines[1]).toContain('Rõ')
    expect(res.text).not.toMatch(/[0-9a-f]{24}/)
  })
})

describe('mức chỉ số theo nhà (ANALYTICS-FR-012, BR-22)', () => {
  it('chuyên gia sửa → 200; chủ trại khi farm có chuyên gia → 403; ngoài khoảng hoặc CLEAR nhẹ hơn SLIGHT → 400', async () => {
    const { house, ownerToken, expertToken } = await setup()
    const get = await call('get', `/farms/houses/${house._id}/health-levels`, ownerToken)
    expect(get.body.data.health_levels).toEqual(DEFAULT_HEALTH_LEVELS)

    const ok = await call('put', `/farms/houses/${house._id}/health-levels`, expertToken, { in_range_slight_pct: 85, noise_clear: 4 })
    expect(ok.status).toBe(200)
    expect(ok.body.data.health_levels).toMatchObject({ in_range_slight_pct: 85, noise_clear: 4, in_range_clear_pct: 75 })
    expect(await AuditLog.countDocuments({ action: 'HEALTH_LEVELS_UPDATED' })).toBe(1)

    expect((await call('put', `/farms/houses/${house._id}/health-levels`, ownerToken, { noise_clear: 5 })).status).toBe(403)
    expect((await call('put', `/farms/houses/${house._id}/health-levels`, expertToken, { air_clear_h: 13 })).status).toBe(400)
    expect((await call('put', `/farms/houses/${house._id}/health-levels`, expertToken, { in_range_clear_pct: 95 })).status).toBe(400)
  })

  it('farm chưa có chuyên gia → chủ trại sửa được', async () => {
    const { house, owner } = await seedHouse({ withExpert: false })
    const res = await call('put', `/farms/houses/${house._id}/health-levels`, tokenFor(owner._id, 'FARM_OWNER'), { air_slight_h: 2 })
    expect(res.status).toBe(200)
    expect((await House.findById(house._id).lean())!.health_levels.air_slight_h).toBe(2)
  })
})

describe('độ khớp (ANALYTICS-FR-014, NFR-14)', () => {
  it('so ảnh chụp với điểm; INSUFFICIENT_DATA đếm riêng; ngày người gọi còn PENDING bị bỏ ra', async () => {
    const { house, owner, expert, ownerToken } = await setup()
    const rating = (by: { _id: unknown }, role: string, snap: HealthStatus, value: string) =>
      ({ by: by._id, role, outcome: 'RATED', rating: value, at: new Date(), snapshot: { status: snap, reasons: [], levels } })
    await mkDay(house, addDays(TODAY, -3), 'GOOD', { ratings: [rating(owner, 'FARM_OWNER', 'GOOD', 'GOOD'), rating(expert!, 'DOMAIN_EXPERT', 'GOOD', 'GOOD')] })
    await mkDay(house, addDays(TODAY, -2), 'WATCH', { ratings: [rating(owner, 'FARM_OWNER', 'WATCH', 'GOOD')] })
    await mkDay(house, addDays(TODAY, -1), 'INSUFFICIENT_DATA', { ratings: [rating(owner, 'FARM_OWNER', 'INSUFFICIENT_DATA', 'WATCH')] })
    // Chủ trại chưa chấm ngày này: chuyên gia đã chấm nhưng không được tính khi chủ trại xem
    await mkDay(house, TODAY, 'ACTION', { ratings: [rating(expert!, 'DOMAIN_EXPERT', 'ACTION', 'ACTION')] })

    const res = await call('get', `/health-reports/evaluation?houseId=${house._id}&from=${addDays(TODAY, -6)}&to=${TODAY}`, ownerToken)
    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data.rated_count).toBe(3)
    expect(data.insufficient_data_count).toBe(1)
    expect(data.agreement.value).toBeCloseTo(2 / 3)
    expect(data.confusion_matrix.counts).toEqual([[2, 0, 0], [1, 0, 0], [0, 0, 0]])
    // 3 lần người chấm GOOD, hệ thống báo WATCH 1 lần
    expect(data.false_alarm_rate.combined).toBeCloseTo(1 / 3)
    // flock luôn CLEAR trong ảnh chụp → mọi lần GOOD đều là báo động giả của riêng nguồn đàn chim
    expect(data.false_alarm_rate.flock).toBe(1)
    expect(data.false_alarm_rate.environment).toBe(0)
    expect(data.ratings).toHaveLength(4)
    expect(data.ratings.map((r: { date: string }) => r.date)).not.toContain(TODAY)

    const ownerOnly = await call('get', `/health-reports/evaluation?houseId=${house._id}&from=${addDays(TODAY, -6)}&to=${TODAY}&role=DOMAIN_EXPERT`, ownerToken)
    expect(ownerOnly.body.data.rated_count).toBe(1)
  })
})
