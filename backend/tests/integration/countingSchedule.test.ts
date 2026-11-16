/**
 * VISION-FR-008, 019, 020, BR-21 — lịch đếm của nhà (hồ sơ theo mùa, khung tạm), phiên tính từ số 5 phút theo khung
 * của ngày, phiên không đầy đủ khi nút AI mất kết nối, kiểm tra buổi tối theo giờ của từng nhà.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { CameraNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import {
  checkReturnRateDrops, claimDueHouses, computeHouseSessions, houseDailyCounts, ingestBirdCount,
} from '@/services/birdCount.service'
import { addDays } from '@/utils/countingSchedule.util'
import type { Role } from '@/types'
import { useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitBirdCountUpdate: jest.fn(), emitNotificationNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitHouseDeviceStatusChange: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use(errorHandler)

useTestDb()
beforeAll(async () => { await Promise.all([BirdCountRecord.init(), BirdCountBucket.init()]) })
afterEach(async () => {
  await Promise.all([BirdCountBucket.deleteMany({}), CameraNode.deleteMany({}), Notification.deleteMany({})])
})

const tokenFor = (id: unknown, role: Role) => jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const vnAt = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`)
const RAINY = { morning: { start: '06:00', end: '07:30' }, evening: { start: '17:00', end: '18:30' } }

let seq = 0
async function seed({ withExpert = true } = {}) {
  seq++
  const mk = (role: Role, p: string) => User.create({ email: `${p}${seq}@cs.vn`, password_hash: 'password123', full_name: p, role })
  const [owner, expert, tech, otherTech] = await Promise.all([
    mk('FARM_OWNER', 'o'), mk('DOMAIN_EXPERT', 'e'), mk('FARM_TECHNICIAN', 't'), mk('FARM_TECHNICIAN', 'x'),
  ])
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [
      { user_id: owner._id, is_primary: true }, { user_id: tech._id, role: 'FARM_TECHNICIAN' }, { user_id: otherTech._id, role: 'FARM_TECHNICIAN' },
      ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : []),
    ],
  })
  const house = await House.create({ farm_id: farm._id, name: `Nhà ${seq}`, technicians: [{ user_id: tech._id, primary: true }] })
  await House.create({ farm_id: farm._id, name: `Nhà khác ${seq}`, technicians: [{ user_id: otherTech._id, primary: true }] })
  const [camA, camB] = await Promise.all(['a', 'b'].map(side => CameraNode.create({
    device_id: `cam-${side}-${seq}`, house_id: house._id, rtsp_url: 'rtsp://x/s', status: 'ONLINE', last_heartbeat: new Date(),
  })))
  const t = {
    owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT'),
    tech: tokenFor(tech._id, 'FARM_TECHNICIAN'), otherTech: tokenFor(otherTech._id, 'FARM_TECHNICIAN'),
  }
  const call = (method: 'get' | 'put', token: string, body?: object) =>
    request(app)[method](`/farms/houses/${house._id}/counting-schedule`).set('Authorization', `Bearer ${token}`).send(body)
  return { owner, farm, house, camA, camB, t, call }
}

/** Số 5 phút của một camera, `hhmm` giờ VN */
const bucket = (camera: { _id: unknown; house_id: unknown }, date: string, hhmm: string, exit_count: number, entry_count: number) =>
  BirdCountBucket.create({ camera_node_id: camera._id, house_id: camera.house_id, bucket_start: vnAt(date, hhmm), exit_count, entry_count })

describe('VISION-FR-019 — counting schedule', () => {
  it('the Domain Expert stores a schedule with history, applied from the next day; the house technician reads it', async () => {
    const s = await seed()
    const body = { profiles: [{ name: 'Mùa mưa', from: '09-01', to: '01-14', ...RAINY }], temporary: [] }
    const saved = await s.call('put', s.t.expert, body)
    expect(saved.status).toBe(200)
    const tomorrow = addDays(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10), 1)
    expect(saved.body.data).toMatchObject({ effective_from: tomorrow, schedule: body })
    expect(saved.body.data.history).toHaveLength(1)
    // Hôm nay vẫn theo lịch cũ (mặc định)
    expect(saved.body.data.today.source).toBe('DEFAULT')
    expect(await AuditLog.countDocuments({ action: 'COUNTING_SCHEDULE_UPDATED' })).toBe(1)
    expect(await Notification.countDocuments({ user_id: s.owner._id })).toBe(1)

    expect((await s.call('get', s.t.tech)).body.data.schedule).toEqual(body)
    expect((await s.call('get', s.t.otherTech)).status).toBe(403)
    expect((await s.call('put', s.t.tech, body)).status).toBe(403)
  })

  it('rejects an invalid schedule with 400 and a wrong shape with 422', async () => {
    const s = await seed()
    const overlap = { profiles: [{ name: 'A', from: '01-01', to: '03-31', ...RAINY }, { name: 'B', from: '03-01', to: '04-30', ...RAINY }] }
    expect((await s.call('put', s.t.expert, overlap)).status).toBe(400)
    const badWindow = { temporary: [{ from: '2026-11-20', to: '2026-11-20', ...RAINY, evening: { start: '18:30', end: '17:00' } }] }
    expect((await s.call('put', s.t.expert, badWindow)).status).toBe(400)
    expect((await s.call('put', s.t.expert, { profiles: 'mùa mưa' })).status).toBe(422)
  })

  it('BR-22: the Farm Owner is rejected while the farm has a Domain Expert and accepted while it has none', async () => {
    const withExpert = await seed()
    expect((await withExpert.call('put', withExpert.t.owner, { temporary: [] })).status).toBe(403)
    const withoutExpert = await seed({ withExpert: false })
    expect((await withoutExpert.call('put', withoutExpert.t.owner, { temporary: [] })).status).toBe(200)
  })
})

describe('VISION-FR-008, 020 — sessions from the 5-minute counts', () => {
  const DAY = '2026-11-10'

  it('sums the 5-minute counts of both cameras inside the windows of the day and stores those windows', async () => {
    const s = await seed()
    await Promise.all([
      bucket(s.camA, DAY, '05:30', 400, 10), bucket(s.camA, DAY, '06:55', 100, 0), bucket(s.camB, DAY, '06:00', 500, 40),
      bucket(s.camA, DAY, '07:00', 999, 999), // sau khung sáng 05:30–07:00
      bucket(s.camA, DAY, '17:30', 5, 300), bucket(s.camB, DAY, '18:55', 15, 600),
      bucket(s.camB, DAY, '12:00', 77, 77), // giữa ngày, ngoài hai phiên
    ])
    await computeHouseSessions(String(s.house._id), DAY)
    const [day] = await houseDailyCounts(String(s.house._id), { from: DAY, to: DAY })
    expect(day).toMatchObject({ morning_exit: 1000, morning_entry: 50, evening_entry: 900, evening_exit: 20, incomplete: false })
    expect(day.return_rate).toBeCloseTo((880 / 950) * 100, 1)
    const records = await BirdCountRecord.find({ house_id: s.house._id }).lean()
    expect(records).toHaveLength(4)
    expect(records.filter(r => r.session_type === 'MORNING_EXIT').every(r => r.window_start === '05:30' && r.window_end === '07:00')).toBe(true)
  })

  it('uses a temporary window of the day, and a computed day keeps its windows after the schedule changes', async () => {
    const s = await seed()
    await House.updateOne({ _id: s.house._id }, {
      counting_schedule_history: [{
        schedule: { profiles: [], temporary: [{ from: DAY, to: DAY, ...RAINY }] }, effective_from: '2026-11-01',
        changed_by: s.owner._id, changed_by_role: 'DOMAIN_EXPERT', changed_at: new Date(),
      }],
    })
    await Promise.all([bucket(s.camA, DAY, '07:15', 300, 0), bucket(s.camA, DAY, '17:00', 0, 280)])
    await computeHouseSessions(String(s.house._id), DAY)
    let [day] = await houseDailyCounts(String(s.house._id), { from: DAY, to: DAY })
    expect(day).toMatchObject({ morning_exit: 300, evening_entry: 280 })

    // Lịch đổi về mặc định cho ngày đó, rồi số trễ về: phiên tính lại vẫn theo khung đã lưu
    await House.updateOne({ _id: s.house._id }, { counting_schedule_history: [] })
    await ingestBirdCount({ deviceId: s.camA.device_id, kind: 'BUCKET', bucket_start: vnAt(DAY, '07:20').getTime(), exit_count: 20, entry_count: 0 })
    ;[day] = await houseDailyCounts(String(s.house._id), { from: DAY, to: DAY })
    expect(day.morning_exit).toBe(320)
    expect((await BirdCountRecord.findOne({ house_id: s.house._id, session_type: 'EVENING_ENTRY' }).lean())?.window_start).toBe('17:00')
  })

  it('a session message of the AI node arriving after the computation does not overwrite the session', async () => {
    const s = await seed()
    await bucket(s.camA, DAY, '05:30', 400, 0)
    await computeHouseSessions(String(s.house._id), DAY)
    expect(await ingestBirdCount({
      deviceId: s.camA.device_id, session_type: 'MORNING_EXIT', exit_count: 999, entry_count: 0, timestamp: vnAt(DAY, '06:00').getTime(),
    })).toBeNull()
    const [day] = await houseDailyCounts(String(s.house._id), { from: DAY, to: DAY })
    expect(day.morning_exit).toBe(400)
  })

  it('VISION-FR-020: an AI node offline during the evening window makes the day incomplete, left out of the check and the baseline', async () => {
    const s = await seed()
    const days = [-4, -3, -2, -1, 0].map(n => addDays(DAY, n))
    // Nền 95 %; ngày −1 chỉ 10 % nhưng không đầy đủ; hôm nay 70 %. Nếu ngày −1 lọt vào nền thì trung bình còn 73,75 %
    // và 70 % không còn là mức giảm quá 20 %
    const evening: Record<string, number> = { [days[3]]: 100, [DAY]: 700 }
    for (const date of days) {
      await Promise.all([bucket(s.camA, date, '06:00', 1000, 0), bucket(s.camA, date, '18:00', 0, evening[date] ?? 950)])
    }
    const offline = (date: string) => Alert.create({
      farm_id: s.farm._id, house_id: s.house._id, type: 'EDGE_AI_DEGRADED', severity: 'MEDIUM', title: 'x', message: 'x',
      status: 'RESOLVED', created_at: vnAt(date, '18:10'), resolved_at: vnAt(date, '18:40'),
    })
    await Promise.all([offline(days[3]), offline(DAY)])
    for (const date of days) await computeHouseSessions(String(s.house._id), date)
    const counts = await houseDailyCounts(String(s.house._id), { from: days[0], to: DAY })
    expect(counts.map(d => d.incomplete)).toEqual([false, false, false, true, true])
    // Hôm nay không đầy đủ: không mở cảnh báo dù tỷ lệ giảm (70 % so với 95 %)
    expect(await checkReturnRateDrops(DAY)).toBe(0)

    // Hôm nay nút AI không mất kết nối: có cảnh báo, vì ngày −1 không đầy đủ không vào nền
    await Alert.deleteMany({ type: 'EDGE_AI_DEGRADED', created_at: { $gte: vnAt(DAY, '00:00') } })
    await BirdCountRecord.deleteMany({ house_id: s.house._id, session_date: DAY })
    await computeHouseSessions(String(s.house._id), DAY)
    expect(await checkReturnRateDrops(DAY)).toBe(1)
  })
})

describe('BR-21 — evening check per house', () => {
  it('claims each house once a day, 15 min after its own evening window', async () => {
    const s = await seed()
    const date = '2026-11-17'
    // Nhà có khung chiều tới 20:00 hôm đó
    await House.updateOne({ _id: s.house._id }, {
      counting_schedule_history: [{
        schedule: { profiles: [], temporary: [{ from: date, to: date, ...RAINY, evening: { start: '18:30', end: '20:00' } }] },
        effective_from: '2026-11-01', changed_by: s.owner._id, changed_by_role: 'DOMAIN_EXPERT', changed_at: new Date(),
      }],
    })
    const other = await House.findOne({ farm_id: s.farm._id, _id: { $ne: s.house._id } }).lean()

    expect((await claimDueHouses(vnAt(date, '19:10'))).houseIds).toEqual([])
    expect((await claimDueHouses(vnAt(date, '19:15'))).houseIds).toEqual([String(other!._id)])
    expect((await claimDueHouses(vnAt(date, '19:20'))).houseIds).toEqual([])
    expect((await claimDueHouses(vnAt(date, '20:15'))).houseIds).toEqual([String(s.house._id)])
    expect((await claimDueHouses(vnAt(date, '21:00'))).houseIds).toEqual([])
  })
})
