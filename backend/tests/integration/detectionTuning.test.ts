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
import { Notification } from '@/models/notification.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import { getBirdCountTrends } from '@/services/analytics.service'
import { vnDate } from '@/services/birdCount.service'
import { buildDeviceConfig } from '@/services/deviceConfig.service'
import { SensorNode } from '@/models/device.model'
import { DEFAULT_BIRD_COUNT_TUNING, DEFAULT_DETECTION_TUNING, resolveDetectionTuning } from '@/utils/detectionTuning.util'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import type { CurrentUser, Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
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
  const node = await SensorNode.create({ device_id: `ESP32-DT-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const put = (token: string, body: object) =>
    request(app).put(`/farms/zones/${zone._id}/detection-tuning`).set('Authorization', `Bearer ${token}`).send(body)
  const putHouse = (token: string, body: object, houseId: unknown = house._id) =>
    request(app).put(`/farms/houses/${houseId}/bird-count-tuning`).set('Authorization', `Bearer ${token}`).send(body)
  return { owner, expert, farm, house, zone, node, put, putHouse, t: { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') } }
}

describe('PUT /farms/zones/:zoneId/detection-tuning', () => {
  it('Zone mới có sẵn bộ mặc định', async () => {
    const { zone } = await seed()
    expect((await Zone.findById(zone._id))!.toObject().detection_tuning).toEqual(DEFAULT_DETECTION_TUNING)
  })

  it('Domain Expert lưu tham số kèm lịch sử + audit, và chỉ 5 tham số của firmware được gửi xuống thiết bị', async () => {
    const { zone, node, expert, put, t } = await seed()

    const res = await put(t.expert, { noise_margin_db: 12, pump_dry_on_sec: '240' })

    expect(res.status).toBe(200)
    const saved = (await Zone.findById(zone._id))!.toObject()
    expect(saved.detection_tuning).toEqual({ ...DEFAULT_DETECTION_TUNING, noise_margin_db: 12, pump_dry_on_sec: 240 })
    expect(saved.detection_tuning_history).toHaveLength(1)
    expect(saved.detection_tuning_history[0]).toMatchObject({
      changed_by_role: 'DOMAIN_EXPERT', old_values: DEFAULT_DETECTION_TUNING,
      new_values: { noise_margin_db: 12, pump_dry_on_sec: 240 },
    })
    expect(String(saved.detection_tuning_history[0].changed_by)).toBe(String(expert._id))
    expect(publishDeviceConfig).toHaveBeenCalledWith(node.device_id, expect.objectContaining({
      noise_margin_db: 12, noise_min_sec: 10, pump_dry_on_sec: 240, pump_dry_min_rise_pct: 2, speaker_drop_pct: 70,
    }))
    expect(await AuditLog.countDocuments({ action: 'DETECTION_TUNING_UPDATED' })).toBe(1)
  })

  it('Farm Owner trên farm có chuyên gia: áp ngay và mở mục duyệt cho chuyên gia (BR-22)', async () => {
    const { zone, put, t } = await seed()
    expect((await put(t.owner, { noise_margin_db: 12 })).status).toBe(200)
    const res = await request(app).get(`/farms/zones/${zone._id}`).set('Authorization', `Bearer ${t.owner}`)
    expect(res.body.data.detection_tuning).toMatchObject({ noise_margin_db: 12 })
    expect(publishDeviceConfig).toHaveBeenCalled()
    const review = await ParameterReview.findOne({ target_id: zone._id, group: 'detection' }).lean()
    expect(review).toMatchObject({ status: 'PENDING_REVIEW', zone_id: zone._id, old_values: DEFAULT_DETECTION_TUNING })
    expect(review!.new_values).toMatchObject({ noise_margin_db: 12 })
    expect(await Notification.countDocuments({ 'ref.kind': 'parameter_review' })).toBe(1)
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
    expect(publishDeviceConfig).not.toHaveBeenCalled()
  })
})

describe('PUT /farms/houses/:houseId/bird-count-tuning (SRS v2.1.8)', () => {
  it('House mới có sẵn mức mặc định 20%', async () => {
    const { house } = await seed()
    expect((await House.findById(house._id))!.toObject().bird_count_tuning).toEqual(DEFAULT_BIRD_COUNT_TUNING)
  })

  it('Domain Expert lưu kèm lịch sử + audit, không gửi gì xuống thiết bị', async () => {
    const { house, expert, putHouse, t } = await seed()
    const res = await putHouse(t.expert, { return_rate_drop_pct: '30' })
    expect(res.status).toBe(200)
    const saved = (await House.findById(house._id))!.toObject()
    expect(saved.bird_count_tuning).toEqual({ return_rate_drop_pct: 30 })
    expect(saved.bird_count_tuning_history).toHaveLength(1)
    expect(saved.bird_count_tuning_history[0]).toMatchObject({
      changed_by_role: 'DOMAIN_EXPERT', old_values: DEFAULT_BIRD_COUNT_TUNING, new_values: { return_rate_drop_pct: 30 },
    })
    expect(String(saved.bird_count_tuning_history[0].changed_by)).toBe(String(expert._id))
    expect(await AuditLog.countDocuments({ action: 'BIRD_COUNT_TUNING_UPDATED' })).toBe(1)
    expect(publishDeviceConfig).not.toHaveBeenCalled()
  })

  it('Farm Owner sửa được và mở mục duyệt theo nhà; chuyên gia của farm khác không sửa được', async () => {
    const { house, putHouse, t } = await seed()
    const other = await seed()
    expect((await putHouse(other.t.expert, { return_rate_drop_pct: 30 }, house._id)).status).toBe(403)
    expect((await House.findById(house._id))!.toObject().bird_count_tuning).toEqual(DEFAULT_BIRD_COUNT_TUNING)
    expect((await putHouse(t.owner, { return_rate_drop_pct: 30 })).status).toBe(200)
    expect(await ParameterReview.findOne({ target_id: house._id, group: 'return_rate_drop' }).lean())
      .toMatchObject({ status: 'PENDING_REVIEW', house_id: house._id, new_values: { return_rate_drop_pct: 30 } })
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

describe('khoá lạ → 400, không lặng lẽ bỏ qua (todo-audit-1118 B-04, bug W-01)', () => {
  it('mức giảm tỷ lệ chim về gửi nhầm vào Zone → 400 kèm gợi ý endpoint của nhà; không lưu, không gửi thiết bị', async () => {
    const { zone, put, t } = await seed()
    const res = await put(t.expert, { noise_margin_db: 12, return_rate_drop_pct: 30 })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('return_rate_drop_pct')
    expect(res.body.error.message).toContain('/bird-count-tuning')
    expect((await Zone.findById(zone._id))!.toObject().detection_tuning).toEqual(DEFAULT_DETECTION_TUNING)
    expect(publishDeviceConfig).not.toHaveBeenCalled()
  })

  it('tham số của Zone gửi vào nhà, hoặc khoá lạ bất kỳ → 400', async () => {
    const { house, put, putHouse, t } = await seed()
    expect((await putHouse(t.expert, { return_rate_drop_pct: 30, noise_margin_db: 12 })).status).toBe(400)
    expect((await put(t.expert, { noise_margin_db: 12, unknown_key: 1 })).status).toBe(400)
    expect((await House.findById(house._id))!.toObject().bird_count_tuning).toEqual(DEFAULT_BIRD_COUNT_TUNING)
  })
})

describe('khôi phục mặc định (EXPERT-FR-008 "reset to defaults", todo-audit-1118 B-05)', () => {
  const reset = (path: string, token: string) => request(app).put(path).set('Authorization', `Bearer ${token}`)

  it('Zone: về DEFAULT_DETECTION_TUNING, thêm dòng lịch sử, audit, tăng config_version và gửi thiết bị', async () => {
    const { zone, node, put, t } = await seed()
    await put(t.expert, { noise_margin_db: 12 }).expect(200)
    const versionBefore = (await Zone.findById(zone._id))!.toObject().config_version ?? 0
    jest.clearAllMocks()

    const res = await reset(`/farms/zones/${zone._id}/detection-tuning/reset`, t.expert)

    expect(res.status).toBe(200)
    const saved = (await Zone.findById(zone._id))!.toObject()
    expect(saved.detection_tuning).toEqual(DEFAULT_DETECTION_TUNING)
    expect(saved.detection_tuning_history).toHaveLength(2)
    expect(saved.detection_tuning_history[1]).toMatchObject({ changed_by_role: 'DOMAIN_EXPERT', new_values: DEFAULT_DETECTION_TUNING })
    expect(saved.config_version ?? 0).toBeGreaterThan(versionBefore)
    expect(publishDeviceConfig).toHaveBeenCalledWith(node.device_id, expect.objectContaining({ noise_margin_db: DEFAULT_DETECTION_TUNING.noise_margin_db }))
    expect(await AuditLog.countDocuments({ action: 'DETECTION_TUNING_UPDATED' })).toBe(2)
  })

  it('nhà: về DEFAULT_BIRD_COUNT_TUNING, có lịch sử và audit, không gửi thiết bị', async () => {
    const { house, putHouse, t } = await seed()
    await putHouse(t.expert, { return_rate_drop_pct: 35 }).expect(200)
    jest.clearAllMocks()

    const res = await reset(`/farms/houses/${house._id}/bird-count-tuning/reset`, t.expert)

    expect(res.status).toBe(200)
    expect(res.body.data.bird_count_tuning).toEqual(DEFAULT_BIRD_COUNT_TUNING)
    const saved = (await House.findById(house._id))!.toObject()
    expect(saved.bird_count_tuning_history).toHaveLength(2)
    expect(await AuditLog.countDocuments({ action: 'BIRD_COUNT_TUNING_UPDATED' })).toBe(2)
    expect(publishDeviceConfig).not.toHaveBeenCalled()
  })

  it('chuyên gia farm khác → 403; Farm Owner reset được, có chuyên gia thì mở mục duyệt, chưa có thì không (BR-22)', async () => {
    const { farm, zone, house, put, putHouse, t } = await seed()
    const other = await seed()
    expect((await reset(`/farms/zones/${zone._id}/detection-tuning/reset`, other.t.expert)).status).toBe(403)
    // Để lần đưa về mặc định của Farm Owner là một thay đổi thật
    expect((await put(t.expert, { noise_margin_db: 20 })).status).toBe(200)
    expect((await putHouse(t.expert, { return_rate_drop_pct: 30 })).status).toBe(200)
    expect((await reset(`/farms/zones/${zone._id}/detection-tuning/reset`, t.owner)).status).toBe(200)
    expect((await reset(`/farms/houses/${house._id}/bird-count-tuning/reset`, t.owner)).status).toBe(200)
    expect(await ParameterReview.countDocuments({ farm_id: farm._id, status: 'PENDING_REVIEW' })).toBe(2)

    await ParameterReview.deleteMany({})
    await Farm.updateOne({ _id: farm._id }, { $pull: { members: { role: 'DOMAIN_EXPERT' } } })
    expect((await reset(`/farms/zones/${zone._id}/detection-tuning/reset`, t.owner)).status).toBe(200)
    expect((await reset(`/farms/houses/${house._id}/bird-count-tuning/reset`, t.owner)).status).toBe(200)
    expect(await ParameterReview.countDocuments({})).toBe(0)
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
    // Mốc = trung bình 7 ngày trước ngày mới nhất = 90; mới nhất 60 → giảm 33,3%; ngày thứ 9 (30) ngoài mốc
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
