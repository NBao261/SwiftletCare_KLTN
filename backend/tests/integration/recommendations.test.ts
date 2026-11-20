/**
 * EXPERT-FR-016…019, BR-42, Report 3 §6.21 — vòng khuyến nghị: Domain Expert viết luật, job hằng ngày mở khuyến nghị
 * khi luật thoả, Farm Owner chấp nhận (Work Order hoặc thay đổi tham số theo MF-05) hoặc từ chối, hết hạn sau 7 ngày,
 * đo hiệu quả 7 ngày sau khi chấp nhận.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import recommendationRoutes from '@/routes/recommendations.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Farm } from '@/models/farm.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { Recommendation } from '@/models/recommendation.model'
import { RecommendationRule } from '@/models/recommendationRule.model'
import { User } from '@/models/user.model'
import { WorkOrder } from '@/models/workOrder.model'
import {
  evaluateRecommendationRules, expireRecommendations, measureRecommendationEffects,
} from '@/services/recommendation.service'
import { emitRecommendationNew } from '@/socket'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import { dayOffset } from '@/utils/recommendationRule.util'
import type { Role } from '@/types'
import { useTestDb } from '../helpers/ownerFarm'

jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn(), emitRecommendationNew: jest.fn(),
}))
jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/recommendations', recommendationRoutes)
app.use(errorHandler)

useTestDb()
afterEach(async () => {
  await Promise.all([
    HouseHealthDay.deleteMany({}), Notification.deleteMany({}), ParameterReview.deleteMany({}),
    Recommendation.deleteMany({}), RecommendationRule.deleteMany({}), WorkOrder.deleteMany({}),
  ])
})

const tokenFor = (id: unknown, role: Role) => jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
async function seed({ withExpert = true } = {}) {
  seq++
  const mk = (role: Role, p: string) => User.create({ email: `${p}${seq}@reco.vn`, password_hash: 'password123', full_name: p, role })
  const [owner, expert, tech, admin] = await Promise.all([mk('FARM_OWNER', 'o'), mk('DOMAIN_EXPERT', 'e'), mk('FARM_TECHNICIAN', 't'), mk('ADMIN', 'a')])
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [
      { user_id: owner._id, is_primary: true }, { user_id: tech._id, role: 'FARM_TECHNICIAN' },
      ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : []),
    ],
  })
  const house = await House.create({ farm_id: farm._id, name: 'Nhà A', technicians: [{ user_id: tech._id, primary: true }] })
  const zone = await Zone.create({ house_id: house._id, name: 'Tầng 1' })
  const t = {
    owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT'),
    tech: tokenFor(tech._id, 'FARM_TECHNICIAN'), admin: tokenFor(admin._id, 'ADMIN'),
  }
  const call = (method: 'get' | 'post' | 'put', path: string, token: string, body?: object) =>
    request(app)[method](`/recommendations${path}`).set('Authorization', `Bearer ${token}`).send(body)
  return { owner, expert, farm, house, zone, t, call }
}

const NH3_RULE = {
  name: 'NH3 cao kéo dài', indicator: 'AIR_HOURS_OVER', comparison: 'GTE', value: 4, window_days: 3,
  action: { type: 'WORK_ORDER', title: 'Kiểm tra thông gió, vệ sinh sàn' }, source: 'Ví dụ của EXPERT-FR-017 (Report 3), chờ luật từ phỏng vấn',
}

/** Ngày sức khỏe của nhà với số giờ khí vượt ngưỡng `air` (và % trong ngưỡng `env`) */
async function seedDay(house: { _id: unknown; farm_id: unknown }, date: string, air: number | null, env: number | null = 90, returnRate: number | null = null) {
  await HouseHealthDay.create({
    house_id: house._id, farm_id: house.farm_id, date, computed_at: new Date(), current_status: 'WATCH', current_reasons: [],
    indicators: {
      environment: { value: env, level: null }, air: { value: air, level: null },
      flock: { value: null, level: null, details: { return_rate: returnRate } }, noise: { value: 0, level: null },
    },
    completeness: { environment: true, air: air !== null, flock: false, noise: true },
  })
}

const TODAY = '2026-11-16'

describe('EXPERT-FR-016 — rules', () => {
  it('a rule of the Farm Owner on a farm with an expert waits off until the expert turns it on (BR-22, Report 3 4.2.15)', async () => {
    const { farm, expert, t, call } = await seed()
    const proposed = await call('post', '/rules', t.owner, { farm_id: farm._id, ...NH3_RULE, active: true })
    expect(proposed.status).toBe(201)
    expect(proposed.body.data).toMatchObject({ active: false, pending_approval: true })
    expect(await Notification.countDocuments({ user_id: expert._id, 'ref.kind': 'recommendation_rule' })).toBe(1)
    const id = proposed.body.data._id
    // Farm Owner sửa đề xuất: vẫn tắt, vẫn chờ
    expect((await call('put', `/rules/${id}`, t.owner, { ...NH3_RULE, value: 5, active: true })).body.data)
      .toMatchObject({ value: 5, active: false, pending_approval: true })
    // Chuyên gia bật là duyệt; luật đang chạy thì Farm Owner không sửa được
    expect((await call('put', `/rules/${id}`, t.expert, { ...NH3_RULE, value: 5, active: true })).body.data)
      .toMatchObject({ active: true, pending_approval: false })
    expect((await call('put', `/rules/${id}`, t.owner, { ...NH3_RULE, value: 6 })).status).toBe(403)
  })

  it('on a farm without an expert the Farm Owner turns its own rule on (BR-22)', async () => {
    const { farm, t, call } = await seed({ withExpert: false })
    const created = await call('post', '/rules', t.owner, { farm_id: farm._id, ...NH3_RULE })
    expect(created.status).toBe(201)
    expect(created.body.data).toMatchObject({ active: true, pending_approval: false })
  })

  it('stores a rule of the Domain Expert; unsupported indicator 400; technician 403; list is paginated', async () => {
    const { farm, t, call } = await seed()
    const created = await call('post', '/rules', t.expert, { farm_id: farm._id, ...NH3_RULE })
    expect(created.status).toBe(201)
    expect(created.body.data).toMatchObject({ indicator: 'AIR_HOURS_OVER', active: true })
    expect((await call('post', '/rules', t.expert, { farm_id: farm._id, ...NH3_RULE, indicator: 'HEALTH_GOOD_RATE' })).status).toBe(400)
    expect((await call('post', '/rules', t.expert, { farm_id: farm._id, ...NH3_RULE, window_days: 31 })).status).toBe(400)
    // null không thành ngưỡng 0 áp cho mọi zone
    const nullValue = { type: 'PARAMETER_CHANGE', group: 'thresholds', key: 'humidity_min', value: null }
    expect((await call('post', '/rules', t.expert, { farm_id: farm._id, ...NH3_RULE, action: nullValue })).status).toBe(400)
    const { source: _source, ...noSource } = NH3_RULE
    expect((await call('post', '/rules', t.expert, { farm_id: farm._id, ...noSource })).status).toBe(422)
    expect((await call('post', '/rules', t.tech, { farm_id: farm._id, ...NH3_RULE })).status).toBe(403)

    const list = await call('get', `/rules?farmId=${farm._id}&limit=1`, t.owner)
    expect(list.body.meta).toEqual({ total: 1, page: 1, limit: 1 })
    // Bật/tắt
    const off = await call('put', `/rules/${created.body.data._id}`, t.expert, { ...NH3_RULE, active: false })
    expect(off.body.data.active).toBe(false)
    // Sửa mà không gửi `active` thì luật đang tắt vẫn tắt
    const edited = await call('put', `/rules/${created.body.data._id}`, t.expert, { ...NH3_RULE, value: 5 })
    expect(edited.body.data).toMatchObject({ value: 5, active: false })
  })
})

describe('EXPERT-FR-017 — daily evaluation', () => {
  it('TC-F27-01: NH3 above the limit 4 h a day for 3 days raises one OPEN recommendation with its evidence, not a second one', async () => {
    const { farm, house, owner, t, call } = await seed()
    await call('post', '/rules', t.expert, { farm_id: farm._id, ...NH3_RULE })
    for (const [date, hours] of [[dayOffset(TODAY, -2), 5], [dayOffset(TODAY, -1), 4], [TODAY, 6]] as const) await seedDay(house, date, hours)

    expect(await evaluateRecommendationRules(TODAY)).toBe(1)
    expect(await evaluateRecommendationRules(TODAY)).toBe(0)

    const open = await Recommendation.find({ house_id: house._id }).lean()
    expect(open).toHaveLength(1)
    expect(open[0]).toMatchObject({ status: 'OPEN', raised_for: TODAY })
    expect(open[0].evidence.days.map(d => d.value)).toEqual([5, 4, 6])
    expect(await Notification.countDocuments({ user_id: owner._id })).toBe(1)
    expect(emitRecommendationNew).toHaveBeenCalledWith(String(house._id), expect.objectContaining({ _id: String(open[0]._id) }))
  })

  it('raises nothing when one day misses the condition, a day is missing, or the rule is off', async () => {
    const { farm, house, t, call } = await seed()
    const rule = await call('post', '/rules', t.expert, { farm_id: farm._id, ...NH3_RULE })
    await seedDay(house, dayOffset(TODAY, -2), 5)
    await seedDay(house, TODAY, 6) // hôm qua thiếu ngày đánh giá
    expect(await evaluateRecommendationRules(TODAY)).toBe(0)

    await seedDay(house, dayOffset(TODAY, -1), 3)
    expect(await evaluateRecommendationRules(TODAY)).toBe(0)

    await HouseHealthDay.updateOne({ date: dayOffset(TODAY, -1) }, { 'indicators.air.value': 5 })
    await call('put', `/rules/${rule.body.data._id}`, t.expert, { ...NH3_RULE, active: false })
    expect(await evaluateRecommendationRules(TODAY)).toBe(0)
  })

  it('BR-42: after a decision, a new recommendation needs a whole window of days after the decision day', async () => {
    const { farm, house, t, call } = await seed()
    await call('post', '/rules', t.expert, { farm_id: farm._id, ...NH3_RULE })
    for (let i = -2; i <= 3; i++) await seedDay(house, dayOffset(TODAY, i), 6)
    expect(await evaluateRecommendationRules(TODAY)).toBe(1)
    await Recommendation.updateOne({ house_id: house._id }, {
      status: 'REJECTED', decided_at: new Date(`${TODAY}T20:00:00+07:00`), reject_reason: 'Đã xử lý',
    })
    // Cửa sổ 15…17/11 còn chứa ngày đã quyết định: chưa mở lại
    expect(await evaluateRecommendationRules(dayOffset(TODAY, 1))).toBe(0)
    expect(await evaluateRecommendationRules(dayOffset(TODAY, 2))).toBe(0)
    // Cửa sổ 17…19/11 sau ngày quyết định: mở khuyến nghị mới
    expect(await evaluateRecommendationRules(dayOffset(TODAY, 3))).toBe(1)
  })

  it('BR-46: a house in stage ATTRACTING has no return rate, so a return-rate rule does not hold there', async () => {
    const { farm, house, owner, t, call } = await seed()
    await call('post', '/rules', t.expert, {
      farm_id: farm._id, ...NH3_RULE, name: 'Chim về thấp', indicator: 'RETURN_RATE', comparison: 'LTE', value: 60,
    })
    for (let i = -2; i <= 0; i++) await seedDay(house, dayOffset(TODAY, i), 0, 90, 40)
    await House.updateOne({ _id: house._id }, {
      stage: 'ATTRACTING', stage_history: [{ stage: 'ATTRACTING', changed_by: owner._id, changed_by_role: 'FARM_OWNER', changed_at: new Date('2026-11-01T00:00:00Z') }],
    })
    expect(await evaluateRecommendationRules(TODAY)).toBe(0)
    await House.updateOne({ _id: house._id }, {
      stage: 'OCCUPIED', $push: { stage_history: { stage: 'OCCUPIED', changed_by: owner._id, changed_by_role: 'FARM_OWNER', changed_at: new Date('2026-11-05T00:00:00Z') } },
    })
    expect(await evaluateRecommendationRules(TODAY)).toBe(1)
  })

  it('skips the rules of a deleted farm; misting rules read unassessed days as missing, not as 0', async () => {
    const { farm, house, t, call } = await seed()
    await call('post', '/rules', t.expert, {
      farm_id: farm._id, ...NH3_RULE, name: 'Phun tốt', indicator: 'MISTING_INEFFECTIVE', comparison: 'LTE', value: 0,
    })
    // Chưa có ngày đánh giá nào: không có số liệu thì không thoả
    expect(await evaluateRecommendationRules(TODAY)).toBe(0)
    for (let i = -2; i <= 0; i++) await seedDay(house, dayOffset(TODAY, i), 0)
    await Farm.updateOne({ _id: farm._id }, { is_deleted: true })
    expect(await evaluateRecommendationRules(TODAY)).toBe(0)
    await Farm.updateOne({ _id: farm._id, is_deleted: true }, { is_deleted: false })
    expect(await evaluateRecommendationRules(TODAY)).toBe(1)
  })
})

async function openRecommendation(s: Awaited<ReturnType<typeof seed>>, rule: object = NH3_RULE) {
  const created = await s.call('post', '/rules', s.t.expert, { farm_id: s.farm._id, ...rule })
  return Recommendation.create({
    farm_id: s.farm._id, house_id: s.house._id, rule_id: created.body.data._id, raised_at: new Date(), raised_for: TODAY,
    evidence: { indicator: 'AIR_HOURS_OVER', comparison: 'GTE', value: 4, window_days: 3, days: [] },
  })
}

describe('EXPERT-FR-018 — decision of the Farm Owner', () => {
  it('TC-F27-02: accepting opens exactly one Work Order linked to it; rejecting without a reason → 422', async () => {
    const s = await seed()
    const first = await openRecommendation(s)
    const accepted = await s.call('post', `/${first._id}/accept`, s.t.owner)
    expect(accepted.status).toBe(200)
    expect(accepted.body.data.status).toBe('ACCEPTED')
    const orders = await WorkOrder.find({ recommendation_id: first._id }).lean()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ origin: 'RECOMMENDATION', house_id: s.house._id, title: NH3_RULE.action.title })
    expect(String(accepted.body.data.work_order_id)).toBe(String(orders[0]._id))

    const rule2 = await RecommendationRule.create({ ...NH3_RULE, name: 'Luật 2', farm_id: s.farm._id, author_id: s.expert._id })
    const second = await Recommendation.create({
      farm_id: s.farm._id, house_id: s.house._id, rule_id: rule2._id, raised_at: new Date(), raised_for: TODAY,
      evidence: { indicator: 'AIR_HOURS_OVER', comparison: 'GTE', value: 4, window_days: 3, days: [] },
    })
    expect((await s.call('post', `/${second._id}/reject`, s.t.owner, { reason: ' ' })).status).toBe(422)
    const rejected = await s.call('post', `/${second._id}/reject`, s.t.owner, { reason: 'Đã đổi quạt tuần trước' })
    expect(rejected.body.data).toMatchObject({ status: 'REJECTED', reject_reason: 'Đã đổi quạt tuần trước' })
  })

  it('a closed recommendation cannot be accepted (409); only the Farm Owner decides', async () => {
    const s = await seed()
    const rec = await openRecommendation(s)
    expect((await s.call('post', `/${rec._id}/accept`, s.t.expert)).status).toBe(403)
    expect((await s.call('post', `/${rec._id}/accept`, s.t.tech)).status).toBe(403)
    expect((await s.call('post', `/${rec._id}/reject`, s.t.admin, { reason: 'x' })).status).toBe(403)
    await s.call('post', `/${rec._id}/reject`, s.t.owner, { reason: 'Không phù hợp' })
    expect((await s.call('post', `/${rec._id}/accept`, s.t.owner)).status).toBe(409)
    await Recommendation.updateOne({ _id: rec._id }, { status: 'EXPIRED' })
    expect((await s.call('post', `/${rec._id}/accept`, s.t.owner)).status).toBe(409)
  })

  it('a parameter-change action edits every zone of the house as the Farm Owner, with a review item for the expert (MF-05)', async () => {
    const s = await seed()
    const rec = await openRecommendation(s, {
      ...NH3_RULE, action: { type: 'PARAMETER_CHANGE', group: 'thresholds', key: 'humidity_min', value: 80 },
    })
    const res = await s.call('post', `/${rec._id}/accept`, s.t.owner)
    expect(res.status).toBe(200)
    expect((await Zone.findById(s.zone._id).lean())!.thresholds.humidity_min).toBe(80)
    const reviews = await ParameterReview.find({ zone_id: s.zone._id, status: 'PENDING_REVIEW' }).lean()
    expect(reviews).toHaveLength(1)
    expect(res.body.data.review_ids.map(String)).toEqual([String(reviews[0]._id)])
  })

  it('a fuzzy-coefficient action edits every zone; a value invalid in one zone changes no zone and keeps it OPEN', async () => {
    const s = await seed()
    const fuzzy = await openRecommendation(s, {
      ...NH3_RULE, action: { type: 'PARAMETER_CHANGE', group: 'fuzzy', key: 'fuzzy_window_sec', value: 180 },
    })
    expect((await s.call('post', `/${fuzzy._id}/accept`, s.t.owner)).status).toBe(200)
    expect((await Zone.findById(s.zone._id).lean())!.fuzzy_tuning.fuzzy_window_sec).toBe(180)

    // Tầng 2 có humidity_max 78: humidity_min 80 sai ở đó, nên tầng 1 cũng không bị sửa
    await Zone.create({ house_id: s.house._id, name: 'Tầng 2', thresholds: { ...DEFAULT_THRESHOLDS, humidity_max: 78 } })
    const rec = await openRecommendation(s, {
      ...NH3_RULE, name: 'Ẩm thấp', action: { type: 'PARAMETER_CHANGE', group: 'thresholds', key: 'humidity_min', value: 80 },
    })
    expect((await s.call('post', `/${rec._id}/accept`, s.t.owner)).status).toBe(400)
    expect((await Zone.findById(s.zone._id).lean())!.thresholds.humidity_min).toBe(DEFAULT_THRESHOLDS.humidity_min)
    expect((await Recommendation.findById(rec._id).lean())!.status).toBe('OPEN')
  })

  it('reopens after a failure and reuses the Work Order already opened on retry; accepts the rule as it was when raised', async () => {
    const s = await seed()
    const rule = await s.call('post', '/rules', s.t.expert, { farm_id: s.farm._id, ...NH3_RULE })
    for (let i = -2; i <= 0; i++) await seedDay(s.house, dayOffset(TODAY, i), 6)
    await evaluateRecommendationRules(TODAY)
    const rec = (await Recommendation.findOne({ house_id: s.house._id }).lean())!
    // Luật sửa sau khi khuyến nghị mở: khuyến nghị vẫn theo bản lúc mở
    await s.call('put', `/rules/${rule.body.data._id}`, s.t.expert, { ...NH3_RULE, action: { type: 'WORK_ORDER', title: 'Tiêu đề mới' } })

    const save = jest.spyOn(Recommendation.prototype, 'save').mockRejectedValueOnce(new Error('ghi lỗi'))
    expect((await s.call('post', `/${rec._id}/accept`, s.t.owner)).status).toBe(500)
    save.mockRestore()
    expect((await Recommendation.findById(rec._id).lean())!.status).toBe('OPEN')

    expect((await s.call('post', `/${rec._id}/accept`, s.t.owner)).status).toBe(200)
    const orders = await WorkOrder.find({ recommendation_id: rec._id }).lean()
    expect(orders).toHaveLength(1)
    expect(orders[0].title).toBe(NH3_RULE.action.title)
  })

  it('lets the technician of the house read the recommendations, and keeps other farms out', async () => {
    const s = await seed()
    await openRecommendation(s)
    const asTech = await s.call('get', `?houseId=${s.house._id}`, s.t.tech)
    expect(asTech.status).toBe(200)
    expect(asTech.body.meta.total).toBe(1)
    const other = await seed()
    expect((await s.call('get', `?farmId=${s.farm._id}`, other.t.owner)).status).toBe(403)
    expect((await s.call('get', `/rules?farmId=${s.farm._id}`, other.t.expert)).status).toBe(403)
  })
})

describe('EXPERT-FR-019, BR-42 — expiry and effect', () => {
  it('TC-F27-03: the one accepted 7 days ago becomes MEASURED with change = after − before; the one open for 7 days EXPIRED', async () => {
    const s = await seed()
    const now = new Date('2026-11-17T23:30:00Z') // 18/11 06:30 giờ VN: ngày 16/11 đã được tính lại lúc 19:15 ngày 17/11
    const acceptedAt = new Date('2026-11-09T00:00:00Z') // 09/11 giờ VN
    const accepted = await openRecommendation(s)
    await Recommendation.updateOne({ _id: accepted._id }, { status: 'ACCEPTED', decided_at: acceptedAt })
    const stale = await Recommendation.create({
      farm_id: s.farm._id, house_id: s.house._id, rule_id: accepted.rule_id, raised_at: acceptedAt, raised_for: '2026-11-09',
      evidence: { indicator: 'AIR_HOURS_OVER', comparison: 'GTE', value: 4, window_days: 3, days: [] },
    })
    // 7 ngày trước (02…08/11): 6 giờ; 7 ngày sau (10…16/11): 2 giờ
    for (let i = 1; i <= 7; i++) {
      await seedDay(s.house, dayOffset('2026-11-09', -i), 6)
      await seedDay(s.house, dayOffset('2026-11-09', i), 2)
    }

    expect(await expireRecommendations(now)).toBe(1)
    // Đã quá 7 × 24 giờ nhưng ngày thứ 7 (16/11) chưa được tính lại: 16/11 08:00 và 17/11 06:30 giờ VN chưa đo
    expect(await measureRecommendationEffects(new Date('2026-11-16T01:00:00Z'))).toBe(0)
    expect(await measureRecommendationEffects(new Date('2026-11-16T23:30:00Z'))).toBe(0)
    expect(await measureRecommendationEffects(now)).toBe(1)
    expect((await Recommendation.findById(stale._id).lean())!.status).toBe('EXPIRED')
    const measured = (await Recommendation.findById(accepted._id).lean())!
    expect(measured.status).toBe('MEASURED')
    expect(measured.effect).toMatchObject({ before: 6, after: 2, change: -4, improved: true })

    const effects = await s.call('get', `/rules/effects?farmId=${s.farm._id}`, s.t.expert)
    const row = effects.body.data.find((r: { rule_id: string }) => r.rule_id === String(accepted.rule_id))
    // Cùng luật: khuyến nghị đã đo và khuyến nghị hết hạn
    expect(row).toMatchObject({ raised: 2, accepted: 1, measured: 1, improved: 1 })
  })
})
