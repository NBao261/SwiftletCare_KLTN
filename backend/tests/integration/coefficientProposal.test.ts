/**
 * EXPERT-FR-011, Report 3 §6.11 — đề xuất hệ số: trên farm có Domain Expert chỉ chuyên gia áp gợi ý
 * của hệ thống; Farm Owner gửi đề xuất (PROPOSED), chuyên gia duyệt (APPROVED, lịch sử
 * SUGGESTION_APPROVED) hoặc từ chối có lý do (REJECTED); đề xuất mới hơn hoặc chuyên gia tự sửa hệ số
 * thì đề xuất cũ SUPERSEDED. Farm chưa có chuyên gia: Farm Owner áp trực tiếp (BR-22).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import expertActivityRoutes from '@/routes/expertActivity.route'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { requestContext } from '@/middlewares/requestContext.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import { getTuningSuggestion } from '@/services/tuningSuggestion.service'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true), publishHouseCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn(), emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn() }))
jest.mock('@/services/telegram.service', () => ({ sendTelegram: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/services/tuningSuggestion.service', () => ({ getTuningSuggestion: jest.fn() }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use(requestContext)
app.use('/farms', farmRoutes)
app.use('/expert-activity', expertActivityRoutes)
app.use(errorHandler)

const SUGGESTION = { fuzzy_humidity_band: 10, fuzzy_temp_band: 5, fuzzy_fan_dry_level: 50 }
const PREDICTED = { inRangeNow: 70, inRangeSuggested: 82, mistingNow: 30, mistingSuggested: 28 }
const suggest = (suggestion: object | null, reason: string | null = null) =>
  jest.mocked(getTuningSuggestion).mockResolvedValue({ current: {}, model: null, predicted: PREDICTED, suggestion, reason } as never)

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
beforeEach(() => suggest(SUGGESTION))
afterEach(async () => {
  jest.clearAllMocks()
  await Promise.all([AuditLog, CoefficientProposal, Farm, House, Zone, Notification, User].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
async function seed({ withExpert = true } = {}) {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'Chủ', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'Chuyên gia', role: 'DOMAIN_EXPERT' })
  const farm = await Farm.create({
    name: 'F', address: 'x', coordinates: { lat: 10, lng: 106 }, owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : [])],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Tầng 1' })
  const t = { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') }
  const send = (method: 'get' | 'put' | 'post', path: string, token: string, body: object = {}) =>
    request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)
  const submit = () => send('post', '/expert-activity/proposals', t.owner, { zoneId: String(zone._id) })
  return { owner, expert, farm, zone, t, send, submit }
}

const fuzzyOf = async (zoneId: unknown) => (await Zone.findById(zoneId).lean())!

describe('Farm Owner gửi đề xuất (EXPERT-FR-011)', () => {
  it('PROPOSED kèm gợi ý và hệ số đang dùng; chuyên gia được báo; hệ số Zone chưa đổi', async () => {
    const { expert, zone, submit } = await seed()
    const res = await submit().expect(201)
    expect(res.body.data).toMatchObject({
      status: 'PROPOSED', suggested_values: SUGGESTION, predicted: PREDICTED,
      current_values: expect.objectContaining({ fuzzy_humidity_band: 8, fuzzy_temp_band: 4, fuzzy_fan_dry_level: 40 }),
    })
    expect((await fuzzyOf(zone._id)).fuzzy_tuning.fuzzy_humidity_band).toBe(8)
    expect((await Notification.findOne({ user_id: expert._id }).lean())?.ref).toMatchObject({ kind: 'coefficient_proposal' })
  })

  it('gửi lần nữa → đề xuất cũ SUPERSEDED; chuyên gia tự sửa hệ số → SUPERSEDED', async () => {
    const { zone, t, send, submit } = await seed()
    const first = (await submit().expect(201)).body.data
    const second = (await submit().expect(201)).body.data
    expect((await CoefficientProposal.findById(first._id).lean())!.status).toBe('SUPERSEDED')

    await send('put', `/farms/zones/${zone._id}/fuzzy-tuning`, t.expert, { fuzzy_temp_band: 6 }).expect(200)
    expect((await CoefficientProposal.findById(second._id).lean())!.status).toBe('SUPERSEDED')
  })

  it('không có gợi ý → 409 kèm lý do; farm chưa có chuyên gia → 409', async () => {
    const s = await seed()
    suggest(null, 'Cần ít nhất 3 ngày dữ liệu')
    const res = await s.submit().expect(409)
    expect(res.body.error.message).toContain('3 ngày')

    suggest(SUGGESTION)
    const solo = await seed({ withExpert: false })
    await solo.submit().expect(409)
    expect(await CoefficientProposal.countDocuments()).toBe(0)
  })
})

describe('chuyên gia duyệt / từ chối (Report 3 §6.11)', () => {
  it('duyệt → hệ số áp, lịch sử SUGGESTION_APPROVED, APPROVED, Farm Owner nhận đúng 1 thông báo', async () => {
    const { owner, zone, t, send, submit } = await seed()
    const proposal = (await submit().expect(201)).body.data
    await send('put', `/expert-activity/proposals/${proposal._id}/approve`, t.expert).expect(200)

    const after = await fuzzyOf(zone._id)
    expect(after.fuzzy_tuning).toMatchObject(SUGGESTION)
    expect(after.fuzzy_tuning_history.at(-1)).toMatchObject({ source: 'SUGGESTION_APPROVED', changed_by_role: 'DOMAIN_EXPERT' })
    expect((await CoefficientProposal.findById(proposal._id).lean())!.status).toBe('APPROVED')
    expect(await Notification.countDocuments({ user_id: owner._id })).toBe(1)
  })

  it('từ chối thiếu lý do → 422; có lý do → REJECTED, hệ số giữ nguyên', async () => {
    const { zone, t, send, submit } = await seed()
    const proposal = (await submit().expect(201)).body.data
    await send('put', `/expert-activity/proposals/${proposal._id}/reject`, t.expert, { note: '  ' }).expect(422)
    const res = await send('put', `/expert-activity/proposals/${proposal._id}/reject`, t.expert, { note: 'Mùa mưa, giữ hệ số cũ' }).expect(200)
    expect(res.body.data).toMatchObject({ status: 'REJECTED', note: 'Mùa mưa, giữ hệ số cũ' })
    expect((await fuzzyOf(zone._id)).fuzzy_tuning.fuzzy_humidity_band).toBe(8)
  })

  it('đề xuất đã đóng → 409; Farm Owner không duyệt được (403)', async () => {
    const { t, send, submit } = await seed()
    const proposal = (await submit().expect(201)).body.data
    await send('put', `/expert-activity/proposals/${proposal._id}/approve`, t.owner).expect(403)
    await send('put', `/expert-activity/proposals/${proposal._id}/approve`, t.expert).expect(200)
    await send('put', `/expert-activity/proposals/${proposal._id}/approve`, t.expert).expect(409)
    await send('put', `/expert-activity/proposals/${proposal._id}/reject`, t.expert, { note: 'x' }).expect(409)
  })

  it('danh sách đề xuất theo farm, lọc trạng thái', async () => {
    const { farm, t, send, submit } = await seed()
    await submit().expect(201)
    await submit().expect(201)
    const res = await send('get', `/expert-activity/proposals?farmId=${farm._id}&status=PROPOSED`, t.expert).expect(200)
    expect(res.body.meta.total).toBe(1)
  })
})

describe('áp gợi ý trực tiếp (EXPERT-FR-011, BR-22)', () => {
  it('farm có chuyên gia: Farm Owner → 403, hệ số giữ nguyên; Domain Expert áp được', async () => {
    const { zone, t, send } = await seed()
    await send('post', `/farms/zones/${zone._id}/fuzzy-tuning/apply-suggestion`, t.owner).expect(403)
    expect((await fuzzyOf(zone._id)).fuzzy_tuning.fuzzy_humidity_band).toBe(8)

    await send('post', `/farms/zones/${zone._id}/fuzzy-tuning/apply-suggestion`, t.expert).expect(200)
    const after = await fuzzyOf(zone._id)
    expect(after.fuzzy_tuning).toMatchObject(SUGGESTION)
    expect(after.fuzzy_tuning_history.at(-1)!.source).toBe('SUGGESTION_APPROVED')
  })

  it('farm chưa có chuyên gia: Farm Owner áp trực tiếp; không có gợi ý → 409', async () => {
    const { zone, t, send } = await seed({ withExpert: false })
    await send('post', `/farms/zones/${zone._id}/fuzzy-tuning/apply-suggestion`, t.owner).expect(200)
    expect((await fuzzyOf(zone._id)).fuzzy_tuning).toMatchObject(SUGGESTION)

    suggest(null, 'Hệ số hiện tại đã gần tốt nhất')
    await send('post', `/farms/zones/${zone._id}/fuzzy-tuning/apply-suggestion`, t.owner).expect(409)
  })
})
