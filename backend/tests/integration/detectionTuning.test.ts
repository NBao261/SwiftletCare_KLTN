/**
 * EXPERT-FR-008 — tham số phát hiện do Domain Expert chỉnh: 5 tham số theo Zone (SRS v2.1.0) gửi
 * xuống ESP32 qua config/update; mức giảm tỷ lệ chim về theo House (SRS v2.1.8, camera ở cửa ra vào
 * của cả nhà) thay cho hằng số 20% ở xu hướng và cảnh báo LOW_RETURN_RATE. Kiểm khoảng, lịch sử + audit.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { publishCommand } from '@/mqtt/mqtt.client'
import { getBirdCountTrends } from '@/services/analytics.service'
import { vnDate } from '@/services/birdCount.service'
import { buildDeviceConfig } from '@/services/device.service'
import { DEFAULT_BIRD_COUNT_TUNING, DEFAULT_DETECTION_TUNING, resolveDetectionTuning } from '@/utils/detectionTuning.util'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import type { CurrentUser, Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
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
  await Promise.all([AuditLog, BirdCountRecord, Farm, House, Zone, User].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  const put = (token: string, body: object) =>
    request(app).put(`/farms/zones/${zone._id}/detection-tuning`).set('Authorization', `Bearer ${token}`).send(body)
  const putHouse = (token: string, body: object, houseId: unknown = house._id) =>
    request(app).put(`/farms/houses/${houseId}/bird-count-tuning`).set('Authorization', `Bearer ${token}`).send(body)
  return { owner, expert, farm, house, zone, put, putHouse, t: { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') } }
}

describe('PUT /farms/zones/:zoneId/detection-tuning', () => {
  it('Zone mới có sẵn bộ mặc định', async () => {
    const { zone } = await seed()
    expect((await Zone.findById(zone._id))!.toObject().detection_tuning).toEqual(DEFAULT_DETECTION_TUNING)
  })

  it('Domain Expert lưu tham số kèm lịch sử + audit, và chỉ 5 tham số của firmware được gửi xuống thiết bị', async () => {
    const { farm, house, zone, expert, put, t } = await seed()

    // return_rate_drop_pct không còn là tham số của Zone (SRS v2.1.8) → bị bỏ như key lạ
    const res = await put(t.expert, { noise_margin_db: 12, pump_dry_on_sec: '240', return_rate_drop_pct: 30, unknown_key: 1 })

    expect(res.status).toBe(200)
    const saved = (await Zone.findById(zone._id))!.toObject()
    expect(saved.detection_tuning).toEqual({ ...DEFAULT_DETECTION_TUNING, noise_margin_db: 12, pump_dry_on_sec: 240 })
    expect(saved.detection_tuning_history).toHaveLength(1)
    expect(saved.detection_tuning_history[0]).toMatchObject({
      changed_by_role: 'DOMAIN_EXPERT', old_values: DEFAULT_DETECTION_TUNING,
      new_values: { noise_margin_db: 12, pump_dry_on_sec: 240 },
    })
    expect(String(saved.detection_tuning_history[0].changed_by)).toBe(String(expert._id))
    expect(publishCommand).toHaveBeenCalledWith(String(farm._id), String(house._id), String(zone._id), 'config/update', {
      noise_margin_db: 12, noise_min_sec: 10, pump_dry_on_sec: 240, pump_dry_min_rise_pct: 2, speaker_drop_pct: 70,
    })
    expect(await AuditLog.countDocuments({ action: 'DETECTION_TUNING_UPDATED' })).toBe(1)
  })

  it('Farm Owner xem được nhưng không sửa được', async () => {
    const { zone, put, t } = await seed()
    expect((await put(t.owner, { noise_margin_db: 12 })).status).toBe(403)
    const res = await request(app).get(`/farms/zones/${zone._id}`).set('Authorization', `Bearer ${t.owner}`)
    expect(res.body.data.detection_tuning).toEqual(DEFAULT_DETECTION_TUNING)
  })

  it.each([
    ['biên độ ồn dưới 5 dB', { noise_margin_db: 4 }],
    ['số giây ồn vượt cửa sổ 15 giây', { noise_min_sec: 16 }],
    ['số giây ồn lẻ', { noise_min_sec: 7.5 }],
    ['thời gian bơm khô dưới 2 phút', { pump_dry_on_sec: 60 }],
    ['mức tăng độ ẩm trên 10', { pump_dry_min_rise_pct: 11 }],
    ['mức giảm loa trên 90%', { speaker_drop_pct: 95 }],
    ['giá trị không phải số', { noise_margin_db: 'abc' }],
    ['body không có tham số nào', { foo: 1 }],
    ['chỉ có mức giảm tỷ lệ chim về (giờ thuộc House)', { return_rate_drop_pct: 30 }],
  ])('từ chối %s', async (_label, body) => {
    const { put, t } = await seed()
    expect((await put(t.expert, body)).status).toBe(400)
    expect(publishCommand).not.toHaveBeenCalled()
  })
})

describe('PUT /farms/houses/:houseId/bird-count-tuning (SRS v2.1.8)', () => {
  it('House mới có sẵn mức mặc định 20%', async () => {
    const { house } = await seed()
    expect((await House.findById(house._id))!.toObject().bird_count_tuning).toEqual(DEFAULT_BIRD_COUNT_TUNING)
  })

  it('Domain Expert lưu kèm lịch sử + audit, không gửi gì xuống thiết bị', async () => {
    const { house, expert, putHouse, t } = await seed()
    const res = await putHouse(t.expert, { return_rate_drop_pct: '30', noise_margin_db: 12 })
    expect(res.status).toBe(200)
    const saved = (await House.findById(house._id))!.toObject()
    expect(saved.bird_count_tuning).toEqual({ return_rate_drop_pct: 30 })
    expect(saved.bird_count_tuning_history).toHaveLength(1)
    expect(saved.bird_count_tuning_history[0]).toMatchObject({
      changed_by_role: 'DOMAIN_EXPERT', old_values: DEFAULT_BIRD_COUNT_TUNING, new_values: { return_rate_drop_pct: 30 },
    })
    expect(String(saved.bird_count_tuning_history[0].changed_by)).toBe(String(expert._id))
    expect(await AuditLog.countDocuments({ action: 'BIRD_COUNT_TUNING_UPDATED' })).toBe(1)
    expect(publishCommand).not.toHaveBeenCalled()
  })

  it('Farm Owner và chuyên gia của farm khác không sửa được', async () => {
    const { house, putHouse, t } = await seed()
    const other = await seed()
    expect((await putHouse(t.owner, { return_rate_drop_pct: 30 })).status).toBe(403)
    expect((await putHouse(other.t.expert, { return_rate_drop_pct: 30 }, house._id)).status).toBe(403)
    expect((await House.findById(house._id))!.toObject().bird_count_tuning).toEqual(DEFAULT_BIRD_COUNT_TUNING)
  })

  it.each([
    ['dưới 5%', { return_rate_drop_pct: 1 }],
    ['trên 50%', { return_rate_drop_pct: 60 }],
    ['không phải số', { return_rate_drop_pct: 'abc' }],
    ['không có tham số nào', { noise_margin_db: 12 }],
  ])('từ chối mức giảm %s', async (_label, body) => {
    const { putHouse, t } = await seed()
    expect((await putHouse(t.expert, body)).status).toBe(400)
  })
})

describe('đưa tham số vào cấu hình thiết bị và xu hướng chim về', () => {
  const node = { speaker_schedule: { enabled: true, windows: [] }, audio: { volume: 20, current_track: 3, playing: false, loop: true } }

  it('buildDeviceConfig gửi đủ 5 tham số của Zone, không có tham số đếm chim của House', () => {
    const cfg = buildDeviceConfig(
      { thresholds: DEFAULT_THRESHOLDS, fuzzy_tuning: DEFAULT_FUZZY_TUNING, detection_tuning: { ...DEFAULT_DETECTION_TUNING, speaker_drop_pct: 50 } }, node,
    )
    expect(cfg).toMatchObject({ noise_margin_db: 15, noise_min_sec: 10, pump_dry_on_sec: 300, pump_dry_min_rise_pct: 2, speaker_drop_pct: 50 })
    expect(cfg).not.toHaveProperty('return_rate_drop_pct')
  })

  it('Zone tạo trước v2.1.0 (chưa có detection_tuning) nhận bộ mặc định', () => {
    const cfg = buildDeviceConfig({ thresholds: DEFAULT_THRESHOLDS, fuzzy_tuning: DEFAULT_FUZZY_TUNING }, node)
    expect(cfg).toMatchObject({ noise_margin_db: 15, speaker_drop_pct: 70 })
    expect(resolveDetectionTuning({ noise_margin_db: 9 })).toEqual({ ...DEFAULT_DETECTION_TUNING, noise_margin_db: 9 })
  })

  it('cờ "giảm đáng kể" của tỷ lệ chim về dùng return_rate_drop_pct của House', async () => {
    const { owner, house } = await seed()
    const user: CurrentUser = { _id: String(owner._id), email: owner.email, role: 'FARM_OWNER' }
    const day = (n: number) => new Date(Date.now() - n * 86400_000)
    // Mốc = trung bình 7 ngày trước ngày mới nhất = 90 (không gồm chính nó); mới nhất 60 → giảm 33,3%.
    // 9 ngày: ngày xa nhất (30) nằm ngoài mốc 7 ngày nên không kéo mốc xuống.
    // Mỗi ngày: phiên sáng ròng ra 100 con, phiên chiều ròng về `rate` con → tỷ lệ = rate %
    const camera = new mongoose.Types.ObjectId()
    await BirdCountRecord.create([8, 7, 6, 5, 4, 3, 2, 1, 0].flatMap((n, i) => {
      const rate = i === 8 ? 60 : i === 0 ? 30 : 90
      const base = { camera_node_id: camera, house_id: house._id, timestamp: day(n), session_date: vnDate(day(n)) }
      return [
        { ...base, session_type: 'MORNING_EXIT', entry_count: 0, exit_count: 100 },
        { ...base, session_type: 'EVENING_ENTRY', entry_count: rate, exit_count: 0 },
      ]
    }))

    const byDefault = await getBirdCountTrends(user, { houseId: String(house._id) }, { days: 10 })
    expect(byDefault).toMatchObject({ drop_percent: 33.3, drop_threshold_pct: 20, is_significant_drop: true })

    await House.updateOne({ _id: house._id }, { 'bird_count_tuning.return_rate_drop_pct': 40 })
    const tuned = await getBirdCountTrends(user, { houseId: String(house._id) }, { days: 10 })
    expect(tuned).toMatchObject({ drop_percent: 33.3, drop_threshold_pct: 40, is_significant_drop: false })
  })
})
