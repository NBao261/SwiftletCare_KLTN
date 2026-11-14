/**
 * G-25 — ANALYTICS-FR-015 tổng quan trại, ANALYTICS-FR-016 / BR-44 so sánh nhà, ANALYTICS-FR-017 / BR-45 điện năng
 * ước tính, ANALYTICS-FR-002 xu hướng đàn, VISION-FR-011 lượng mưa trên LOW_RETURN_RATE, SYSTEM-FR-004 nhãn giả lập.
 */
jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import analyticsRoutes from '@/routes/analytics.route'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { WorkOrder } from '@/models/workOrder.model'
import { flockTrend } from '@/services/analytics.service'
import { checkReturnRateDrops, vnDate } from '@/services/birdCount.service'
import { houseEnergyByMonth } from '@/services/energy.service'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use('/analytics', analyticsRoutes)
app.use(errorHandler)

useTestDb()
afterEach(async () => {
  await Promise.all([
    BirdCountBucket.deleteMany({}), CameraNode.deleteMany({}), HouseHealthDay.deleteMany({}),
    WeatherObservation.deleteMany({}), WorkOrder.deleteMany({}),
  ])
})

const DAY = 86_400_000
const HOUR = 3_600_000
let seq = 0

async function memberUser(farm: Awaited<ReturnType<typeof seedOwnerFarm>>['farm'], role: Role) {
  seq++
  const user = await User.create({ email: `ov${seq}@test.vn`, password_hash: 'password123', full_name: `${role}${seq}`, role })
  if (role !== 'ADMIN') farm.members.push({ user_id: user._id, role } as never)
  await farm.save()
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}
const member = async (farm: Awaited<ReturnType<typeof seedOwnerFarm>>['farm'], role: Role) => (await memberUser(farm, role)).token

/** Ngày giờ VN cách hôm nay `offset` ngày ('YYYY-MM-DD') */
const vnDay = (offset: number) => vnDate(new Date(Date.now() + offset * DAY))

/** Phiên sáng và chiều của 1 ngày: `exit` chim ra (ròng), `back` chim về (ròng) */
const sessions = (houseId: unknown, cameraId: unknown, date: string, exit: number, back: number) => BirdCountRecord.create([
  { camera_node_id: cameraId, house_id: houseId, timestamp: new Date(`${date}T06:00:00+07:00`), session_date: date, session_type: 'MORNING_EXIT', entry_count: 0, exit_count: exit },
  { camera_node_id: cameraId, house_id: houseId, timestamp: new Date(`${date}T18:00:00+07:00`), session_date: date, session_type: 'EVENING_ENTRY', entry_count: back, exit_count: 0 },
])

/** Farm 3 nhà: H (thật, của seedOwnerFarm), H2 và H3 (mọi thiết bị đều giả lập) */
async function seedFarm() {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  await House.updateOne({ _id: house._id }, { name: 'A nhà thật' })
  const house2 = await House.create({ farm_id: ctx.farm._id, name: 'B giả lập', stage: 'ATTRACTING' })
  const house3 = await House.create({ farm_id: ctx.farm._id, name: 'C giả lập' })
  const zone2 = await Zone.create({ house_id: house2._id, farm_id: ctx.farm._id, name: 'Z2' })
  const zone3 = await Zone.create({ house_id: house3._id, farm_id: ctx.farm._id, name: 'Z3' })
  const node2 = await SensorNode.create({ device_id: `SIM-2-${++seq}`, zone_id: zone2._id, status: 'ONLINE', simulated: true })
  await SensorNode.create({ device_id: `SIM-3-${++seq}`, zone_id: zone3._id, status: 'ONLINE', simulated: true })
  await CameraNode.create({ device_id: `SIMCAM-3-${++seq}`, house_id: house3._id, status: 'ONLINE', simulated: true })
  return { ...ctx, house, house2, house3, zone2, zone3, node2 }
}

describe('tổng quan trại (ANALYTICS-FR-015) — TC-F29-01', () => {
  it('mỗi nhà: giai đoạn, trạng thái hôm nay hoặc lý do, cảnh báo và Work Order đang mở, tỷ lệ về gần nhất; nhà giả lập có nhãn', async () => {
    const { farm, token, house, house2, house3, zone, zone2 } = await seedFarm()
    const today = vnDay(0)
    await HouseHealthDay.create([
      { house_id: house._id, farm_id: farm._id, date: today, current_status: 'GOOD', computed_at: new Date() },
      { house_id: house2._id, farm_id: farm._id, date: today, current_status: 'INSUFFICIENT_DATA', computed_at: new Date() },
      // Ngày hôm qua của C không phải trạng thái hôm nay
      { house_id: house3._id, farm_id: farm._id, date: vnDay(-1), current_status: 'ACTION', computed_at: new Date() },
    ])
    const base = { farm_id: farm._id, severity: 'MEDIUM', title: 't', message: 'm' }
    await Alert.create([
      { ...base, zone_id: zone._id, type: 'THRESHOLD_BREACH', status: 'ACTIVE' },
      { ...base, zone_id: zone._id, type: 'SENSOR_FAULT', status: 'ACKNOWLEDGED' },
      { ...base, zone_id: zone._id, type: 'NOISE_ANOMALY', status: 'DISMISSED' },
      { ...base, zone_id: zone._id, type: 'NODE_OFFLINE', status: 'RESOLVED', resolved_at: new Date() },
      { ...base, zone_id: zone2._id, type: 'NODE_OFFLINE', status: 'ACTIVE' },
      { ...base, house_id: house3._id, type: 'EDGE_AI_DEGRADED', status: 'ACTIVE' },
    ])
    await WorkOrder.create([
      { farm_id: farm._id, house_id: house._id, origin: 'MANUAL', title: 'mở', status: 'IN_PROGRESS', is_open: true },
      { farm_id: farm._id, house_id: house._id, origin: 'MANUAL', title: 'đóng', status: 'CLOSED', is_open: false },
    ])
    const camera = new mongoose.Types.ObjectId()
    await sessions(house._id, camera, vnDay(-3), 100, 90)
    await sessions(house._id, camera, vnDay(-2), 100, 80)
    // Hôm qua chỉ có phiên sáng: chưa có tỷ lệ, tỷ lệ gần nhất vẫn là của 2 ngày trước
    await BirdCountRecord.create({ camera_node_id: camera, house_id: house._id, timestamp: new Date(), session_date: vnDay(-1), session_type: 'MORNING_EXIT', entry_count: 0, exit_count: 50 })

    const res = await request(app).get(`/farms/${farm._id}/overview`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data.date).toBe(today)
    expect(res.body.data.houses).toEqual([
      expect.objectContaining({
        house_id: String(house._id), stage: 'OCCUPIED', status: 'GOOD', status_reason: null, open_alerts: 2,
        open_work_orders: 1, latest_return_rate: { date: vnDay(-2), value: 80 }, simulated: false,
      }),
      expect.objectContaining({
        house_id: String(house2._id), stage: 'ATTRACTING', status: null, status_reason: 'INSUFFICIENT_DATA',
        open_alerts: 1, open_work_orders: 0, latest_return_rate: null, simulated: true,
      }),
      expect.objectContaining({ house_id: String(house3._id), status: null, status_reason: 'NOT_COMPUTED', open_alerts: 1, simulated: true }),
    ])
  })

  it('Domain Expert đọc được; Farm Technician và Administrator → 403', async () => {
    const { farm } = await seedFarm()
    const expert = await member(farm, 'DOMAIN_EXPERT')
    const technician = await member(farm, 'FARM_TECHNICIAN')
    const admin = await member(farm, 'ADMIN')
    await request(app).get(`/farms/${farm._id}/overview`).set('Authorization', `Bearer ${expert}`).expect(200)
    await request(app).get(`/farms/${farm._id}/comparison`).set('Authorization', `Bearer ${expert}`).expect(200)
    for (const token of [technician, admin]) {
      await request(app).get(`/farms/${farm._id}/overview`).set('Authorization', `Bearer ${token}`).expect(403)
      await request(app).get(`/farms/${farm._id}/comparison`).set('Authorization', `Bearer ${token}`).expect(403)
    }
  })
})

describe('tổng quan và so sánh: quyền, farm, nhà trộn thiết bị', () => {
  it('chủ farm khác → 403; farm không tồn tại → 404', async () => {
    const { farm } = await seedFarm()
    const other = await seedOwnerFarm()
    for (const path of ['overview', 'comparison']) {
      await request(app).get(`/farms/${farm._id}/${path}`).set('Authorization', `Bearer ${other.token}`).expect(403)
      await request(app).get(`/farms/${new mongoose.Types.ObjectId()}/${path}`).set('Authorization', `Bearer ${other.token}`).expect(404)
    }
  })

  it('nhà có cả thiết bị thật và giả lập không phải nhà giả lập (SYSTEM-FR-004)', async () => {
    const { farm, token, house } = await seedFarm()
    await CameraNode.create({ device_id: `SIMCAM-1-${++seq}`, house_id: house._id, status: 'ONLINE', simulated: true })
    const res = await request(app).get(`/farms/${farm._id}/overview`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data.houses.find((h: { house_id: string }) => h.house_id === String(house._id)).simulated).toBe(false)
  })

  it('khoảng quá 366 ngày → 400', async () => {
    const { farm, token, house } = await seedFarm()
    const to = new Date()
    const from = new Date(to.getTime() - 400 * DAY)
    await request(app).get(`/farms/${farm._id}/comparison?from=${from.toISOString()}&to=${to.toISOString()}`).set('Authorization', `Bearer ${token}`).expect(400)
    await request(app).get(`/analytics/energy?houseId=${house._id}&from=${from.toISOString()}&to=${to.toISOString()}`).set('Authorization', `Bearer ${token}`).expect(400)
  })
})

describe('so sánh nhà (ANALYTICS-FR-016, BR-44) — TC-F29-02', () => {
  it('mỗi ô đúng BR-44; sắp theo MTTR, ô trống xuống cuối; không có cột điểm tổng', async () => {
    const { farm, token, house, house2, house3, zone, zone2 } = await seedFarm()
    const to = new Date()
    const from = new Date(to.getTime() - 30 * DAY)
    // 3 ngày được đánh giá của A: 2 GOOD, 1 WATCH; 1 ngày thiếu dữ liệu không vào mẫu số
    await HouseHealthDay.create([
      { house_id: house._id, farm_id: farm._id, date: vnDay(-3), current_status: 'GOOD', indicators: { environment: { value: 90 } }, computed_at: new Date() },
      { house_id: house._id, farm_id: farm._id, date: vnDay(-2), current_status: 'GOOD', indicators: { environment: { value: 80 } }, computed_at: new Date() },
      { house_id: house._id, farm_id: farm._id, date: vnDay(-1), current_status: 'WATCH', indicators: { environment: { value: 70 } }, computed_at: new Date() },
      { house_id: house._id, farm_id: farm._id, date: vnDay(-4), current_status: 'INSUFFICIENT_DATA', computed_at: new Date() },
    ])
    const base = { farm_id: farm._id, severity: 'HIGH', title: 't', message: 'm' }
    const ago = (ms: number) => new Date(to.getTime() - ms)
    // A: MTTR (60 + 120) / 2 = 90 phút; B: MTTR 30 phút; C: không cảnh báo
    await Alert.create([
      { ...base, zone_id: zone._id, type: 'THRESHOLD_BREACH', status: 'RESOLVED', created_at: ago(5 * DAY), resolved_at: ago(5 * DAY - HOUR) },
      { ...base, zone_id: zone._id, type: 'SENSOR_FAULT', status: 'RESOLVED', created_at: ago(4 * DAY), resolved_at: ago(4 * DAY - 2 * HOUR) },
      { ...base, zone_id: zone._id, type: 'NODE_OFFLINE', status: 'ACTIVE', created_at: ago(DAY) },
      { ...base, zone_id: zone2._id, type: 'NODE_OFFLINE', status: 'RESOLVED', created_at: ago(2 * DAY), resolved_at: ago(2 * DAY - HOUR / 2) },
      // Ngoài khoảng: không tính
      { ...base, zone_id: zone2._id, type: 'NODE_OFFLINE', status: 'RESOLVED', created_at: ago(40 * DAY), resolved_at: ago(40 * DAY - 10 * HOUR) },
    ])
    // Xu hướng đàn của A: kỳ trước trung bình 100 chim ra, kỳ này 110 → +10 %; tỷ lệ về kỳ này (90 + 80) / 2
    const camera = new mongoose.Types.ObjectId()
    await sessions(house._id, camera, vnDay(-40), 100, 95)
    await sessions(house._id, camera, vnDay(-35), 100, 95)
    await sessions(house._id, camera, vnDay(-5), 100, 90)
    await sessions(house._id, camera, vnDay(-4), 120, 96)

    const q = `from=${from.toISOString()}&to=${to.toISOString()}`
    const res = await request(app).get(`/farms/${farm._id}/comparison?${q}&sort=mttr_min&order=asc`).set('Authorization', `Bearer ${token}`).expect(200)
    const rows = res.body.data.rows
    expect(rows.map((r: { house_id: string }) => r.house_id)).toEqual([String(house2._id), String(house._id), String(house3._id)])
    expect(rows[1]).toMatchObject({
      time_in_range_pct: 80, good_days_pct: 66.7, return_rate_avg: 85, flock_trend_pct: 10,
      alerts_raised: 3, alerts_open: 1, mttr_min: 90, energy_kwh: null, last_cycle_yield_g: null,
    })
    expect(rows[0]).toMatchObject({ mttr_min: 30, alerts_raised: 1 })
    expect(rows[2]).toMatchObject({ mttr_min: null, alerts_raised: 0, time_in_range_pct: null, good_days_pct: null })
    for (const row of rows) expect(Object.keys(row).some(k => /score|rank/i.test(k))).toBe(false)

    const byName = await request(app).get(`/farms/${farm._id}/comparison?${q}&sort=name&order=desc`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(byName.body.data.rows.map((r: { name: string }) => r.name)).toEqual(['C giả lập', 'B giả lập', 'A nhà thật'])
    await request(app).get(`/farms/${farm._id}/comparison?sort=score`).set('Authorization', `Bearer ${token}`).expect(422)
    await request(app).get(`/farms/${farm._id}/comparison?from=${to.toISOString()}&to=${from.toISOString()}`).set('Authorization', `Bearer ${token}`).expect(400)
  })
})

describe('điện năng ước tính và xu hướng đàn (ANALYTICS-FR-017, 002) — TC-F29-03', () => {
  it('quạt 1,0 A ở 12 V chạy 10 giờ → 0,12 kWh; bơm không đo dòng → not available; mẫu mất kết nối không tính', async () => {
    const { token, house, zone, node } = await seedFarm()
    const start = new Date('2026-10-05T00:00:00+07:00')
    // 10 giờ mẫu mỗi 30 giây = 1201 mẫu; thêm 1 mẫu sau khoảng mất kết nối 2 giờ (không được tính khoảng trống)
    const tenHours = Array.from({ length: 1201 }, (_, i) => ({
      node_id: node._id, zone_id: zone._id, timestamp: new Date(start.getTime() + i * 30_000),
      ventilation_on: true, fan_current_a: 1.0, misting_on: true,
    }))
    await Telemetry.insertMany([
      ...tenHours,
      { node_id: node._id, zone_id: zone._id, timestamp: new Date(start.getTime() + 12 * HOUR), ventilation_on: true, fan_current_a: 1.0 },
    ])

    const months = await houseEnergyByMonth(house._id, new Date('2026-10-01T00:00:00+07:00'), new Date('2026-11-01T00:00:00+07:00'))
    expect(months).toEqual([{ month: '2026-10', misting_kwh: null, ventilation_kwh: 0.12 }])

    const res = await request(app).get(`/analytics/energy?houseId=${house._id}&from=2026-10-01T00:00:00%2B07:00&to=2026-11-01T00:00:00%2B07:00`)
      .set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data).toMatchObject({ estimated: true, supply_voltage: { misting: 5, ventilation: 12 }, total: { misting_kwh: null, ventilation_kwh: 0.12, total_kwh: 0.12 } })
  })

  it('controller dời sang nhà khác: điện đã dùng vẫn thuộc nhà cũ, điện sau khi dời thuộc nhà mới', async () => {
    const { house, house2, zone, zone2, node } = await seedFarm()
    const start = new Date('2026-10-10T00:00:00+07:00')
    const hourAt = (zoneId: unknown, from: Date) => Array.from({ length: 121 }, (_, i) => ({
      node_id: node._id, zone_id: zoneId, timestamp: new Date(from.getTime() + i * 30_000), ventilation_on: true, fan_current_a: 1.0,
    }))
    await Telemetry.insertMany(hourAt(zone._id, start))
    await SensorNode.updateOne({ _id: node._id }, { zone_id: zone2._id })
    await Telemetry.insertMany(hourAt(zone2._id, new Date(start.getTime() + 5 * HOUR)))

    const range = [new Date('2026-10-01T00:00:00+07:00'), new Date('2026-11-01T00:00:00+07:00')] as const
    // 1 giờ ở 12 V × 1,0 A = 0,012 kWh mỗi nhà
    expect(await houseEnergyByMonth(house._id, ...range)).toEqual([{ month: '2026-10', misting_kwh: null, ventilation_kwh: 0.012 }])
    expect(await houseEnergyByMonth(house2._id, ...range)).toEqual([{ month: '2026-10', misting_kwh: null, ventilation_kwh: 0.012 }])
  })

  it('thợ được giao nhà xem điện năng của nhà đó; nhà chưa được giao → 403', async () => {
    const { farm, house, house2 } = await seedFarm()
    const technician = await memberUser(farm, 'FARM_TECHNICIAN')
    await House.updateOne({ _id: house._id }, { technicians: [{ user_id: technician.user._id, primary: true }] })
    await request(app).get(`/analytics/energy?houseId=${house._id}`).set('Authorization', `Bearer ${technician.token}`).expect(200)
    await request(app).get(`/analytics/energy?houseId=${house2._id}`).set('Authorization', `Bearer ${technician.token}`).expect(403)
  })

  it('8 tuần số đếm: trung bình chim ra buổi sáng theo tuần và theo tháng đúng seed; ngày thiếu phiên bị bỏ', () => {
    const day = (date: string, netExit: number, complete = true) => ({
      date, net_exit: netExit, has_morning: true, has_evening: complete, return_rate: complete ? 90 : null,
    })
    // Thứ Hai 2026-09-07 … 8 tuần; mỗi tuần 2 ngày, tuần k có 100 + 10k chim ra
    const days = Array.from({ length: 8 }, (_, k) => {
      const monday = new Date(Date.parse('2026-09-07T00:00:00Z') + k * 7 * DAY).toISOString().slice(0, 10)
      const wednesday = new Date(Date.parse('2026-09-09T00:00:00Z') + k * 7 * DAY).toISOString().slice(0, 10)
      return [day(monday, 100 + 10 * k), day(wednesday, 100 + 10 * k)]
    }).flat()
    days.push(day('2026-09-08', 9999, false))
    const trend = flockTrend(days)
    expect(trend.weekly).toHaveLength(8)
    expect(trend.weekly[0]).toEqual({ period: '2026-09-07', days: 2, mean_morning_exit: 100, change_pct: null })
    expect(trend.weekly[1]).toEqual({ period: '2026-09-14', days: 2, mean_morning_exit: 110, change_pct: 10 })
    // Tháng 9: tuần 0–3 (100…130) → 115; tháng 10: tuần 4–7 (140…170) → 155
    expect(trend.monthly).toEqual([
      { period: '2026-09', days: 8, mean_morning_exit: 115, change_pct: null },
      { period: '2026-10', days: 8, mean_morning_exit: 155, change_pct: 34.8 },
    ])
  })
})

describe('lượng mưa trên LOW_RETURN_RATE (VISION-FR-011)', () => {
  async function dropToday(houseId: unknown) {
    const camera = new mongoose.Types.ObjectId()
    for (const offset of [-3, -2, -1]) await sessions(houseId, camera, vnDay(offset), 100, 95)
    await sessions(houseId, camera, vnDay(0), 100, 60)
  }

  it('ghi lượng mưa trong khung phiên đếm', async () => {
    const { farm, house } = await seedFarm()
    await dropToday(house._id)
    const today = vnDay(0)
    await BirdCountBucket.create({ camera_node_id: new mongoose.Types.ObjectId(), house_id: house._id, bucket_start: new Date(`${today}T17:30:00+07:00`), entry_count: 5, exit_count: 0 })
    await WeatherObservation.create([
      { farm_id: farm._id, hour: new Date(`${today}T17:00:00+07:00`), precipitation_mm: 2.5 },
      // Ngoài khung phiên chiều: không tính
      { farm_id: farm._id, hour: new Date(`${today}T10:00:00+07:00`), precipitation_mm: 7 },
    ])
    expect(await checkReturnRateDrops(today)).toBe(1)
    const alert = (await Alert.findOne({ type: 'LOW_RETURN_RATE' }).lean())!
    expect(alert.message).toContain('mưa trong phiên đếm 2.5 mm')
    expect(alert.metadata).toMatchObject({ rainMm: 2.5 })
  })

  it('có khung phiên nhưng không có số đo mưa trong khung (chỉ có giờ khác) → ghi không có dữ liệu, không ghi 0 mm', async () => {
    const { farm, house } = await seedFarm()
    await dropToday(house._id)
    const today = vnDay(0)
    await BirdCountBucket.create({ camera_node_id: new mongoose.Types.ObjectId(), house_id: house._id, bucket_start: new Date(`${today}T17:30:00+07:00`), entry_count: 5, exit_count: 0 })
    await WeatherObservation.create({ farm_id: farm._id, hour: new Date(`${today}T09:00:00+07:00`), precipitation_mm: 0 })
    expect(await checkReturnRateDrops(today)).toBe(1)
    const alert = (await Alert.findOne({ type: 'LOW_RETURN_RATE' }).lean())!
    expect(alert.message).toContain('không có dữ liệu thời tiết')
    expect(alert.message).not.toContain('0 mm')
    expect(alert.metadata).toMatchObject({ rainMm: null })
  })

  it('chưa biết khung phiên (chưa có số đếm 5 phút) → ghi mưa cả ngày, không ghi "trong phiên đếm"', async () => {
    const { farm, house } = await seedFarm()
    await dropToday(house._id)
    const today = vnDay(0)
    await WeatherObservation.create([
      { farm_id: farm._id, hour: new Date(`${today}T09:00:00+07:00`), precipitation_mm: 1.5 },
      { farm_id: farm._id, hour: new Date(`${today}T17:00:00+07:00`), precipitation_mm: 2 },
    ])
    expect(await checkReturnRateDrops(today)).toBe(1)
    const alert = (await Alert.findOne({ type: 'LOW_RETURN_RATE' }).lean())!
    expect(alert.message).toContain('mưa cả ngày 3.5 mm')
    expect(alert.message).not.toContain('trong phiên đếm')
  })

  it('không có dữ liệu thời tiết thì ghi rõ', async () => {
    const { house } = await seedFarm()
    await dropToday(house._id)
    expect(await checkReturnRateDrops(vnDay(0))).toBe(1)
    const alert = (await Alert.findOne({ type: 'LOW_RETURN_RATE' }).lean())!
    expect(alert.message).toContain('không có dữ liệu thời tiết')
    expect(alert.metadata).toMatchObject({ rainMm: null })
  })
})
