/**
 * G-26 — HARVEST-FR-005…007, BR-43 (Report 3 §6.13, §6.22): xác nhận lô đóng chu kỳ của zone với sản lượng, so sánh
 * với chu kỳ trước và cùng kỳ năm trước, tỷ lệ ngày GOOD, tỷ lệ chim về, thời gian trong ngưỡng, độ đủ; sửa, xoá, nhập
 * lùi ngày dựng lại chu kỳ. ANALYTICS-FR-004 xu hướng sản lượng; EXPERT-FR-020 kết luận mùa vụ (BR-22).
 */
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))

import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import harvestRoutes from '@/routes/harvests.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { SensorNode } from '@/models/device.model'
import { HarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/harvests', harvestRoutes)
app.use(errorHandler)

useTestDb()
afterEach(async () => {
  await Promise.all([HarvestCycle.deleteMany({}), HouseHealthDay.deleteMany({}), Notification.deleteMany({})])
})

let seq = 0
async function account(role: Role) {
  seq++
  const user = await User.create({ email: `cycle${seq}@test.vn`, password_hash: 'password123', full_name: `${role}${seq}`, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}
const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object = {}) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path: string) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

/** Farm: nhà H (zone Z, controller đăng ký ngày `registeredAt`) giao cho thợ; nhà H2 (zone Z2) không giao; chuyên gia tuỳ chọn */
async function seed(opts: { registeredAt?: string; withExpert?: boolean } = {}) {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const house2 = await House.create({ farm_id: ctx.farm._id, name: 'H2' })
  const zone2 = await Zone.create({ house_id: house2._id, name: 'Z2' })
  await SensorNode.updateOne({ _id: ctx.node._id }, { registered_at: new Date(`${opts.registeredAt ?? '2025-06-01'}T00:00:00+07:00`) })
  const tech = await account('FARM_TECHNICIAN')
  ctx.farm.members.push({ user_id: tech.user._id, role: 'FARM_TECHNICIAN' } as never)
  const expert = opts.withExpert ? await account('DOMAIN_EXPERT') : null
  if (expert) ctx.farm.members.push({ user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never)
  await ctx.farm.save()
  house.technicians = [{ user_id: tech.user._id, primary: true }] as never
  await house.save()
  const owner$ = as(ctx.token)
  const harvest = (date: string, nest = 100, weight = 800, by = owner$) =>
    by.post('/harvests', { zone_id: String(ctx.zone._id), harvest_date: date, nest_count: nest, weight_grams: weight, nest_type: 'RAW' }).expect(201)
  const cycles = async () => (await owner$.get(`/harvests/cycles?zoneId=${ctx.zone._id}&limit=100`).expect(200)).body.data as Array<Record<string, any>>
  const closedOn = async (date: string) => (await cycles()).find(c => c.closing_harvest?.date === date)!
  return { ...ctx, house, house2, zone2, tech, expert, owner$, tech$: as(tech.token), expert$: expert ? as(expert.token) : null, harvest, cycles, closedOn }
}

const sessions = (houseId: unknown, date: string, exit: number, back: number) => {
  const camera = new mongoose.Types.ObjectId()
  return BirdCountRecord.create([
    { camera_node_id: camera, house_id: houseId, timestamp: new Date(`${date}T06:00:00+07:00`), session_date: date, session_type: 'MORNING_EXIT', entry_count: 0, exit_count: exit },
    { camera_node_id: camera, house_id: houseId, timestamp: new Date(`${date}T18:00:00+07:00`), session_date: date, session_type: 'EVENING_ENTRY', entry_count: back, exit_count: 0 },
  ])
}

describe('đóng chu kỳ khi xác nhận (HARVEST-FR-006, 007, BR-43) — TC-F30-02', () => {
  it('lô của thợ được xác nhận: CLOSED với sản lượng (gộp lô cùng ngày), so sánh, tỷ lệ GOOD, tỷ lệ về, thời gian trong ngưỡng; xác nhận lại → 409', async () => {
    const { farm, house, zone, tech$, owner$, harvest, cycles, closedOn } = await seed()
    await harvest('2025-11-05', 100, 800)     // cùng kỳ năm trước (lệch 4 ngày, trong ±30)
    await harvest('2026-07-20', 110, 900)     // chu kỳ trước
    // Ngày sức khỏe và số đếm trong chu kỳ 2026-07-20 … 2026-10-31
    const day = (date: string, status: string, inRange: number) => ({
      house_id: house._id, farm_id: farm._id, date, current_status: status, computed_at: new Date(),
      indicators: { environment: { value: inRange, details: { zones: [{ zone_id: String(zone._id), zone_name: zone.name, in_range_pct: inRange }] } } },
    })
    await HouseHealthDay.create([day('2026-08-01', 'GOOD', 90), day('2026-08-02', 'GOOD', 80), day('2026-08-03', 'WATCH', 70)])
    await sessions(house._id, '2026-08-01', 100, 90)
    await sessions(house._id, '2026-08-02', 100, 80)

    // Hai lô của thợ cùng ngày 2026-11-01 là một lần thu hoạch
    const a = (await harvest('2026-11-01', 120, 950, tech$)).body.data
    const b = (await harvest('2026-11-01', 30, 200, tech$)).body.data
    expect(a.status).toBe('DRAFT')
    await owner$.post(`/harvests/${a._id}/confirm`).expect(200)
    await owner$.post(`/harvests/${b._id}/confirm`).expect(200)
    await owner$.post(`/harvests/${a._id}/confirm`).expect(409)

    const cycle = await closedOn('2026-11-01')
    expect(cycle).toMatchObject({
      status: 'CLOSED',
      closing_harvest: { date: '2026-11-01', nest_count: 150, weight_grams: 1150 },
      comparison: {
        previous: { nest_count: 110, weight_grams: 900, nest_count_change_pct: 36.4, weight_change_pct: 27.8, reason: null },
        same_period_last_year: { nest_count: 100, weight_grams: 800, nest_count_change_pct: 50, weight_change_pct: 43.8, reason: null },
      },
      health: { good_days_pct: 66.7, return_rate_avg: 85, time_in_range_pct: 80 },
      incomplete: true,
    })
    expect(cycle.closing_harvest.batch_ids).toHaveLength(2)
    expect(new Date(cycle.start_date).toISOString()).toBe(new Date('2026-07-20').toISOString())
    // Chu kỳ OPEN mới bắt đầu từ lần thu hoạch vừa đóng (xu hướng sản lượng: các chu kỳ đóng của zone)
    const all = await cycles()
    expect(all[0]).toMatchObject({ status: 'OPEN' })
    expect(new Date(all[0].start_date).toISOString()).toBe(new Date('2026-11-01').toISOString())
    expect(all.filter(c => c.status === 'CLOSED').map(c => c.closing_harvest.nest_count)).toEqual([150, 110, 100])
  })

  it('chu kỳ đầu bắt đầu lúc đăng ký controller đầu tiên; đủ 80 % số ngày được đánh giá thì không "incomplete"; không có chu kỳ trước, năm trước thì có lý do', async () => {
    const { farm, house, harvest, closedOn } = await seed({ registeredAt: '2026-10-01' })
    await HouseHealthDay.create(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map(date => ({
      house_id: house._id, farm_id: farm._id, date, current_status: 'GOOD', computed_at: new Date(),
    })))
    await harvest('2026-10-06')
    const cycle = await closedOn('2026-10-06')
    expect(new Date(cycle.start_date).toISOString()).toBe(new Date('2026-10-01T00:00:00+07:00').toISOString())
    expect(cycle).toMatchObject({ completeness_pct: 80, incomplete: false, health: { good_days_pct: 100 } })
    expect(cycle.comparison.previous).toMatchObject({ nest_count: null, reason: expect.stringContaining('đầu tiên') })
    expect(cycle.comparison.same_period_last_year).toMatchObject({ nest_count: null, reason: expect.stringContaining('±30') })
  })

  it('sửa lô đã xác nhận → số liệu tính lại; xoá lô đóng → chu kỳ gộp vào chu kỳ sau; nhập lùi ngày → dựng lại đúng thứ tự, giữ id chu kỳ', async () => {
    const { owner$, harvest, cycles, closedOn } = await seed()
    await harvest('2026-08-01', 50)
    const middle = (await harvest('2026-09-01', 60)).body.data
    await harvest('2026-10-01', 70)
    const octId = (await closedOn('2026-10-01'))._id

    await owner$.put(`/harvests/${middle._id}`, { nest_count: 66 }).expect(200)
    expect((await closedOn('2026-09-01')).closing_harvest.nest_count).toBe(66)
    expect((await closedOn('2026-10-01')).comparison.previous.nest_count).toBe(66)

    await owner$.delete(`/harvests/${middle._id}`).expect(200)
    const afterDelete = await closedOn('2026-10-01')
    expect(new Date(afterDelete.start_date).toISOString()).toBe(new Date('2026-08-01').toISOString())
    expect(afterDelete.comparison.previous.nest_count).toBe(50)
    expect(await closedOn('2026-09-01')).toBeUndefined()

    await harvest('2026-07-01', 40)
    expect((await cycles()).filter(c => c.status === 'CLOSED').map(c => c.closing_harvest.date)).toEqual(['2026-10-01', '2026-08-01', '2026-07-01'])
    expect(new Date((await closedOn('2026-08-01')).start_date).toISOString()).toBe(new Date('2026-07-01').toISOString())
    expect((await closedOn('2026-10-01'))._id).toBe(octId)
  })
})

describe('kết luận mùa vụ (EXPERT-FR-020, BR-22) — TC-F30-03', () => {
  it('chuyên gia viết → CONCLUDED, mỗi Farm Owner 1 thông báo; Farm Owner khi có chuyên gia, thợ → 403; chu kỳ OPEN → 409; dựng lại vẫn giữ kết luận', async () => {
    const { owner, owner$, tech$, expert$, harvest, cycles, closedOn } = await seed({ withExpert: true })
    await harvest('2026-09-01')
    const closed = await closedOn('2026-09-01')
    const open = (await cycles()).find(c => c.status === 'OPEN')!
    const body = { text: 'Mùa này độ ẩm thấp kéo dài', recommendations: 'Tăng humidity_min lên 78' }

    await owner$.put(`/harvests/cycles/${closed._id}/conclusion`, body).expect(403)
    await tech$.put(`/harvests/cycles/${closed._id}/conclusion`, body).expect(403)
    await expert$!.put(`/harvests/cycles/${open._id}/conclusion`, body).expect(409)
    await expert$!.put(`/harvests/cycles/${closed._id}/conclusion`, { text: '' }).expect(422)
    const res = await expert$!.put(`/harvests/cycles/${closed._id}/conclusion`, body).expect(200)
    expect(res.body.data).toMatchObject({ status: 'CONCLUDED', conclusion: { text: body.text, recommendations: body.recommendations, role: 'DOMAIN_EXPERT' } })
    expect(await Notification.countDocuments({ user_id: owner._id })).toBe(1)

    await harvest('2026-10-01')
    expect(await closedOn('2026-09-01')).toMatchObject({ status: 'CONCLUDED', conclusion: { text: body.text } })
  })

  it('farm chưa có chuyên gia: Farm Owner viết kết luận được (BR-22)', async () => {
    const { owner$, harvest, closedOn } = await seed()
    await harvest('2026-09-01')
    const closed = await closedOn('2026-09-01')
    const res = await owner$.put(`/harvests/cycles/${closed._id}/conclusion`, { text: 'Ổn định' }).expect(200)
    expect(res.body.data).toMatchObject({ status: 'CONCLUDED', conclusion: { role: 'FARM_OWNER' } })
  })
})

describe('đọc chu kỳ (Report 3 §2.4)', () => {
  it('thợ đọc chu kỳ nhà được giao, nhà khác → 403; chuyên gia đọc; Administrator → 403', async () => {
    const { farm, zone, zone2, tech$, expert$, harvest } = await seed({ withExpert: true })
    await harvest('2026-09-01')
    expect((await tech$.get(`/harvests/cycles?zoneId=${zone._id}`).expect(200)).body.data.length).toBe(2)
    expect((await tech$.get('/harvests/cycles').expect(200)).body.meta.total).toBe(2)
    await tech$.get(`/harvests/cycles?zoneId=${zone2._id}`).expect(403)
    expect((await expert$!.get(`/harvests/cycles?farmId=${farm._id}&status=CLOSED`).expect(200)).body.data).toHaveLength(1)
    const admin = await account('ADMIN')
    await as(admin.token).get('/harvests/cycles').expect(403)
    await as(admin.token).get(`/harvests/cycles?zoneId=bad`).expect(403)
  })
})
