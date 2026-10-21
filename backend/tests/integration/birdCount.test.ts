/**
 * VISION-FR-006/008/009/011/012/017, THREAT-FR-010 — số đếm chim từ nút AI qua MQTT, tỷ lệ chim
 * về trên số ròng, cảnh báo LOW_RETURN_RATE, số đếm 5 phút, heartbeat/offline của nút AI.
 * SRS v2.1.8: camera ở cửa ra vào của cả nhà yến → mọi số đếm, cảnh báo, ngưỡng theo House.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import analyticsRoutes from '@/routes/analytics.route'
import deviceRoutes from '@/routes/devices.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { ingestDeviceAlert } from '@/services/alert.service'
import { checkReturnRateDrops, houseDailyCounts, ingestBirdCount, vnDate } from '@/services/birdCount.service'
import { buildZoneMetrics } from '@/services/healthReport.service'
import { CAMERA_OFFLINE_THRESHOLD_MS, markStaleDevicesOffline, recordHeartbeat } from '@/services/device.service'
import { emitBirdCountUpdate, emitHouseAlertNew, emitHouseDeviceStatusChange } from '@/socket'
import type { BirdCountPayload } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitBirdCountUpdate: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitHouseDeviceStatusChange: jest.fn(), emitNotificationNew: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/analytics', analyticsRoutes)
app.use('/devices', deviceRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Promise.all([BirdCountRecord.init(), BirdCountBucket.init()]) // unique index phải có trước khi upsert
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
afterEach(async () => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
  await Promise.all([Alert, BirdCountBucket, BirdCountRecord, CameraNode, Farm, House, SensorNode, Zone, User]
    .map(m => (m as typeof User).deleteMany({})))
})

let seq = 0
/** 1 Farm Owner, 1 nhà yến có 2 Zone (tầng), camera ở cửa ra vào của nhà */
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const house = await House.create({ farm_id: farm._id, name: `Nhà ${seq}` })
  const zone = await Zone.create({ house_id: house._id, name: 'Tầng 1' })
  const upperZone = await Zone.create({ house_id: house._id, name: 'Tầng 2' })
  const camera = await CameraNode.create({ device_id: `cam-${seq}`, house_id: house._id, rtsp_url: 'rtsp://admin:secret@10.0.0.2/s', status: 'ONLINE', last_heartbeat: new Date() })
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  return { owner, farm, house, zone, upperZone, camera, token }
}

/** 2026-10-15 theo giờ VN, `hh:mm` giờ VN → epoch ms */
const vnAt = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`).getTime()
const session = (deviceId: string, session_type: 'MORNING_EXIT' | 'EVENING_ENTRY', exit_count: number, entry_count: number, timestamp: number): BirdCountPayload =>
  ({ deviceId, session_type, exit_count, entry_count, confidence_avg: 0.8, timestamp })
const get = (path: string, token: string, query: object) =>
  request(app).get(path).query(query).set('Authorization', `Bearer ${token}`)

describe('ingestBirdCount — tin của phiên (VISION-FR-006/008/009)', () => {
  it('upsert 1 bản ghi mỗi (camera, phiên, ngày) gắn House, phát BIRD_COUNT_UPDATE vào room của House', async () => {
    const { camera, house } = await seed()
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 50, 2, vnAt('2026-10-15', '05:45')))
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 110, 10, vnAt('2026-10-15', '06:30')))

    const records = await BirdCountRecord.find().lean()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ house_id: house._id, session_date: '2026-10-15', exit_count: 110, entry_count: 10 })
    expect(emitBirdCountUpdate).toHaveBeenLastCalledWith(String(house._id), expect.objectContaining({
      houseId: String(house._id), sessionDate: '2026-10-15', sessionType: 'MORNING_EXIT',
      exitCount: 110, entryCount: 10, netCount: 100, returnRate: null,
    }))
  })

  it('tỷ lệ chim về tính trên số ròng: (95 − 10) / (110 − 10) = 85%', async () => {
    const { camera, house } = await seed()
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 110, 10, vnAt('2026-10-15', '06:30')))
    await ingestBirdCount(session(camera.device_id, 'EVENING_ENTRY', 10, 95, vnAt('2026-10-15', '18:30')))

    const [day] = await houseDailyCounts(String(house._id), { from: '2026-10-15', to: '2026-10-15' })
    expect(day).toMatchObject({ net_exit: 100, net_entry: 85, return_rate: 85 })
    expect(emitBirdCountUpdate).toHaveBeenLastCalledWith(String(house._id), expect.objectContaining({
      sessionType: 'EVENING_ENTRY', entryCount: 95, exitCount: 10, netCount: 85, returnRate: 85,
    }))
  })

  it('chưa có phiên sáng thì tỷ lệ chim về là null, không phải 0', async () => {
    const { camera, house } = await seed()
    await ingestBirdCount(session(camera.device_id, 'EVENING_ENTRY', 0, 80, vnAt('2026-10-15', '18:30')))
    const [day] = await houseDailyCounts(String(house._id))
    expect(day).toMatchObject({ has_morning: false, net_entry: 80, return_rate: null })
    expect(emitBirdCountUpdate).toHaveBeenLastCalledWith(String(house._id), expect.objectContaining({ returnRate: null }))
  })

  it('từ chối payload sai, không ghi DB', async () => {
    const { camera } = await seed()
    await expect(ingestBirdCount(session('cam-khong-co', 'MORNING_EXIT', 1, 0, Date.now()))).rejects.toThrow()
    await expect(ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', -1, 0, Date.now()))).rejects.toThrow()
    await expect(ingestBirdCount({ ...session(camera.device_id, 'MORNING_EXIT', 1, 0, Date.now()), session_type: 'NOON' as never })).rejects.toThrow()
    expect(await BirdCountRecord.countDocuments()).toBe(0)
  })

  it('tin cũ tới sau (QoS 1 giao lại, pipeline khởi động lại mất trạng thái) không kéo số đã lưu xuống', async () => {
    const { camera } = await seed()
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 110, 10, vnAt('2026-10-15', '06:30')))
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 5, 0, vnAt('2026-10-15', '05:40')))
    const record = (await BirdCountRecord.findOne().lean())!
    expect(record).toMatchObject({ exit_count: 110, entry_count: 10 })
    expect(record.timestamp.getTime()).toBe(vnAt('2026-10-15', '06:30'))
  })

  it('from/to không đọc được thành ngày (ISO hợp lệ nhưng JS không parse) → 422, không phải 500', async () => {
    const { house, token } = await seed()
    await get('/analytics/bird-count/daily', token, { houseId: String(house._id), from: '2026-W43' }).expect(422)
    await get('/analytics/bird-count/buckets', token, { houseId: String(house._id), from: '2026-283' }).expect(422)
  })

  it('/daily gom phiên sáng (22:30 UTC hôm trước) và phiên chiều vào cùng 1 ngày VN', async () => {
    const { camera, house, token } = await seed()
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 100, 0, vnAt('2026-10-15', '05:31')))
    await ingestBirdCount(session(camera.device_id, 'EVENING_ENTRY', 0, 90, vnAt('2026-10-15', '18:00')))

    const res = await get('/analytics/bird-count/daily', token, {
      houseId: String(house._id), from: '2026-10-14T00:00:00Z', to: '2026-10-16T00:00:00Z',
    }).expect(200)
    expect(res.body.data.house_id).toBe(String(house._id))
    // Giữ nguyên các trường frontend đang đọc (morning_exit, evening_entry, return_rate), thêm số ròng
    expect(res.body.data.records).toEqual([{
      date: '2026-10-15', morning_entry: 0, morning_exit: 100, evening_entry: 90, evening_exit: 0,
      net_exit: 100, net_entry: 90, return_rate: 90, has_morning: true, has_evening: true,
    }])
  })
})

describe('đếm chim theo House (SRS v2.1.8, VISION-FR-009/012)', () => {
  /**
   * Nhà có 2 cửa ra vào, mỗi cửa 1 camera. Sáng: cửa A ra 60 vào 5, cửa B ra 50 vào 5 → ròng ra 100.
   * Chiều: cửa A về 30, cửa B về 60 ra 5 → ròng về 85 → 85%. Tính riêng từng camera ra 54,5% và 122% — đều sai.
   */
  async function twoDoors() {
    const s = await seed()
    const doorB = await CameraNode.create({ device_id: `cam-${seq}-b`, house_id: s.house._id })
    const now = Date.now()
    await ingestBirdCount(session(s.camera.device_id, 'MORNING_EXIT', 60, 5, now))
    await ingestBirdCount(session(doorB.device_id, 'MORNING_EXIT', 50, 5, now))
    await ingestBirdCount(session(s.camera.device_id, 'EVENING_ENTRY', 0, 30, now))
    await ingestBirdCount(session(doorB.device_id, 'EVENING_ENTRY', 5, 60, now))
    return { ...s, doorB, today: vnDate(new Date(now)) }
  }
  const EXPECTED = {
    morning_entry: 10, morning_exit: 110, evening_entry: 90, evening_exit: 5,
    net_exit: 100, net_entry: 85, return_rate: 85, has_morning: true, has_evening: true,
  }

  it('/current, socket và /daily cho cùng một con số, cộng mọi camera của nhà trước khi lấy số ròng', async () => {
    const { house, token, today } = await twoDoors()

    const current = await get('/analytics/bird-count/current', token, { houseId: String(house._id) }).expect(200)
    expect(current.body.data).toMatchObject({ house_id: String(house._id), date: today, ...EXPECTED })
    expect(current.body.data.updated_at).toEqual(expect.any(String))

    // Tin cuối (camera cửa B, phiên chiều) phát tổng của cả nhà, không phải số của riêng cửa B
    expect(emitBirdCountUpdate).toHaveBeenLastCalledWith(String(house._id), {
      houseId: String(house._id), sessionDate: today, sessionType: 'EVENING_ENTRY',
      entryCount: 90, exitCount: 5, netCount: 85, returnRate: 85, timestamp: expect.any(String),
    })

    const daily = await get('/analytics/bird-count/daily', token, { houseId: String(house._id) }).expect(200)
    expect(daily.body.data.records).toEqual([{ date: today, ...EXPECTED }])
  })

  it('zoneId cũ (frontend/mobile trước v2.1.8) được quy ra nhà chứa Zone — Zone tầng nào cũng ra số của cả nhà', async () => {
    const { house, zone, upperZone, token } = await twoDoors()
    for (const z of [zone, upperZone]) {
      const res = await get('/analytics/bird-count/current', token, { zoneId: String(z._id) }).expect(200)
      expect(res.body.data).toMatchObject({ house_id: String(house._id), ...EXPECTED })
    }
    const trends = await get('/analytics/bird-count/trends', token, { zoneId: String(zone._id) }).expect(200)
    expect(trends.body.data).toMatchObject({ house_id: String(house._id), latest_return_rate: 85 })
  })

  it('báo cáo sức khỏe của mọi Zone trong nhà lấy tỷ lệ chim về của nhà', async () => {
    const { zone, upperZone, today } = await twoDoors()
    expect(await checkReturnRateDrops(today)).toBe(0)      // chưa đủ 3 ngày nền
    for (const z of [zone, upperZone]) {
      const metrics = await buildZoneMetrics(z, new Date(Date.now() - 86_400_000), new Date())
      expect(metrics.avg_return_rate).toBe(85)
    }
  })

  it('2 nhà trong cùng farm không lẫn số của nhau', async () => {
    const { farm, house, token, today } = await twoDoors()
    const other = await House.create({ farm_id: farm._id, name: 'Nhà khác' })
    const otherCam = await CameraNode.create({ device_id: `cam-${seq}-other`, house_id: other._id })
    await ingestBirdCount(session(otherCam.device_id, 'MORNING_EXIT', 999, 0, Date.now()))

    expect((await get('/analytics/bird-count/current', token, { houseId: String(house._id) }).expect(200)).body.data)
      .toMatchObject({ date: today, morning_exit: 110 })
    expect((await get('/analytics/bird-count/current', token, { houseId: String(other._id) }).expect(200)).body.data)
      .toMatchObject({ morning_exit: 999, has_evening: false, return_rate: null })
  })

  it('/current: nhà chưa có số → toàn 0 và tỷ lệ null; farm khác → 403; thiếu houseId → 422', async () => {
    const { house, token } = await seed()
    const res = await get('/analytics/bird-count/current', token, { houseId: String(house._id) }).expect(200)
    expect(res.body.data).toMatchObject({
      house_id: String(house._id), date: vnDate(new Date()), morning_exit: 0, evening_entry: 0, net_exit: 0, net_entry: 0,
      return_rate: null, has_morning: false, has_evening: false, updated_at: null,
    })

    const stranger = await seed()
    await get('/analytics/bird-count/current', stranger.token, { houseId: String(house._id) }).expect(403)
    await get('/analytics/bird-count/current', token, {}).expect(422)
  })
})

describe('số đếm 5 phút (VISION-FR-017)', () => {
  // Mốc tương đối với hiện tại: bird_count_buckets có TTL 90 ngày, ngày cố định sẽ quá hạn ngay khi ghi
  const FIVE_MIN = 5 * 60_000
  const t0 = Math.floor((Date.now() - 3600_000) / FIVE_MIN) * FIVE_MIN
  const iso = (ms: number) => new Date(ms).toISOString()
  const bucket = (deviceId: string, at: number, entry_count: number, exit_count: number): BirdCountPayload =>
    ({ deviceId, kind: 'BUCKET', bucket_start: at, bucket_minutes: 5, entry_count, exit_count })

  it('upsert theo bucket_start, gắn House, không tạo bản ghi phiên', async () => {
    const { camera, house } = await seed()
    await ingestBirdCount(bucket(camera.device_id, t0, 3, 1))
    await ingestBirdCount(bucket(camera.device_id, t0, 4, 2))
    expect(await BirdCountBucket.find().lean()).toEqual([expect.objectContaining({ house_id: house._id, entry_count: 4, exit_count: 2 })])
    expect(await BirdCountRecord.countDocuments()).toBe(0)
    await expect(ingestBirdCount({ ...bucket(camera.device_id, t0, 1, 1), bucket_start: undefined })).rejects.toThrow()
  })

  it('bucket_start lệch vài giây được căn về đầu khoảng 5 phút; tin cũ không kéo số xuống', async () => {
    const { camera } = await seed()
    await ingestBirdCount(bucket(camera.device_id, t0, 4, 2))
    await ingestBirdCount(bucket(camera.device_id, t0 + 7_000, 1, 0))
    const rows = await BirdCountBucket.find().lean()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ entry_count: 4, exit_count: 2 })
    expect(rows[0].bucket_start.getTime()).toBe(t0)
  })

  it('/buckets cộng các camera của nhà; zoneId cũ vẫn chạy; khoảng quá 7 ngày → 400; farm khác → 403', async () => {
    const { camera, house, zone, token } = await seed()
    const second = await CameraNode.create({ device_id: `cam-${seq}-b`, house_id: house._id })
    await ingestBirdCount(bucket(camera.device_id, t0, 3, 1))
    await ingestBirdCount(bucket(second.device_id, t0, 2, 2))
    await ingestBirdCount(bucket(camera.device_id, t0 + FIVE_MIN, 1, 0))

    const buckets = (t: string, q: object) => get('/analytics/bird-count/buckets', t, { houseId: String(house._id), ...q })
    const window = { from: iso(t0 - 3600_000), to: iso(t0 + 3600_000) }
    const expected = [
      { bucket_start: iso(t0), entry_count: 5, exit_count: 3 },
      { bucket_start: iso(t0 + FIVE_MIN), entry_count: 1, exit_count: 0 },
    ]
    expect((await buckets(token, window).expect(200)).body.data.buckets).toEqual(expected)
    const byZone = await get('/analytics/bird-count/buckets', token, { zoneId: String(zone._id), ...window }).expect(200)
    expect(byZone.body.data.buckets).toEqual(expected)
    // Không truyền from/to → mặc định 24 giờ gần nhất, vẫn thấy 2 khoảng vừa ghi
    expect((await buckets(token, {}).expect(200)).body.data.buckets).toHaveLength(2)

    await buckets(token, { from: iso(t0 - 14 * 86_400_000), to: iso(t0) }).expect(400)
    const stranger = await seed()
    await buckets(stranger.token, window).expect(403)
  })
})

describe('checkReturnRateDrops (VISION-FR-011)', () => {
  /** Mỗi ngày: sáng ròng ra 100 con, chiều ròng về `rate` con → tỷ lệ `rate` % */
  async function eveningRates(cameraId: unknown, houseId: unknown, rates: Array<[string, number]>) {
    await BirdCountRecord.create(rates.flatMap(([session_date, rate]) => [
      { camera_node_id: cameraId, house_id: houseId, session_type: 'MORNING_EXIT', session_date,
        timestamp: new Date(`${session_date}T00:00:00Z`), entry_count: 0, exit_count: 100 },
      { camera_node_id: cameraId, house_id: houseId, session_type: 'EVENING_ENTRY', session_date,
        timestamp: new Date(`${session_date}T11:00:00Z`), entry_count: rate, exit_count: 0 },
    ]))
  }

  it('3 ngày trước 90%, hôm nay 60% → LOW_RETURN_RATE của nhà; chạy lại không tạo thêm; hồi lại thì đóng', async () => {
    const { camera, house } = await seed()
    await eveningRates(camera._id, house._id, [['2026-10-12', 90], ['2026-10-13', 90], ['2026-10-14', 90], ['2026-10-15', 60]])

    expect(await checkReturnRateDrops('2026-10-15')).toBe(1)
    expect(await checkReturnRateDrops('2026-10-15')).toBe(0)
    const alert = (await Alert.findOne({ type: 'LOW_RETURN_RATE' }).lean())!
    expect(alert).toMatchObject({ severity: 'LOW', status: 'ACTIVE', house_id: house._id })
    expect(alert.zone_id).toBeUndefined()                  // gắn nhà, không gắn Zone hay camera
    expect(alert.node_id).toBeUndefined()
    expect(alert.metadata).toMatchObject({ dropPct: 33.3, limit: 20 })
    expect(emitHouseAlertNew).toHaveBeenCalledWith(String(house._id), expect.objectContaining({ type: 'LOW_RETURN_RATE' }))

    await eveningRates(camera._id, house._id, [['2026-10-16', 88]])
    expect(await checkReturnRateDrops('2026-10-16')).toBe(0)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('dùng return_rate_drop_pct của House và cần ít nhất 3 ngày nền', async () => {
    const { camera, house } = await seed()
    await House.updateOne({ _id: house._id }, { 'bird_count_tuning.return_rate_drop_pct': 40 })
    await eveningRates(camera._id, house._id, [['2026-10-12', 90], ['2026-10-13', 90], ['2026-10-14', 90], ['2026-10-15', 60]])
    expect(await checkReturnRateDrops('2026-10-15')).toBe(0)

    const other = await seed()
    await eveningRates(other.camera._id, other.house._id, [['2026-10-13', 90], ['2026-10-14', 90], ['2026-10-15', 10]])
    expect(await checkReturnRateDrops('2026-10-15')).toBe(0)
  })

  it('nền là 7 ngày lịch trước đó, không phải 7 bản ghi gần nhất: dữ liệu cũ hơn 7 ngày không tính', async () => {
    const { camera, house } = await seed()
    await eveningRates(camera._id, house._id, [['2026-10-01', 90], ['2026-10-02', 90], ['2026-10-03', 90], ['2026-10-15', 60]])
    expect(await checkReturnRateDrops('2026-10-15')).toBe(0)
    expect(await Alert.countDocuments({ type: 'LOW_RETURN_RATE' })).toBe(0)
  })

  it('lỗi ở một nhà không làm bỏ qua các nhà sau', async () => {
    const days: Array<[string, number]> = [['2026-10-12', 90], ['2026-10-13', 90], ['2026-10-14', 90], ['2026-10-15', 60]]
    const a = await seed()
    const b = await seed()
    await eveningRates(a.camera._id, a.house._id, days)
    await eveningRates(b.camera._id, b.house._id, days)
    jest.spyOn(House, 'findById').mockImplementationOnce(() => { throw new Error('Mongo tạm lỗi') })
    expect(await checkReturnRateDrops('2026-10-15')).toBe(1)
  })

  it('nhà có 2 cửa chỉ ra 1 cảnh báo, tính trên tổng của nhà; 2 nhà cùng farm có cảnh báo riêng', async () => {
    const { camera, house, farm } = await seed()
    const doorB = await CameraNode.create({ device_id: `cam-${seq}-b`, house_id: house._id })
    const days: Array<[string, number]> = [['2026-10-12', 45], ['2026-10-13', 45], ['2026-10-14', 45], ['2026-10-15', 30]]
    await eveningRates(camera._id, house._id, days)
    await eveningRates(doorB._id, house._id, days)          // nhà: ròng ra 200/ngày, ròng về 90 → 90 → 90 → 60

    const second = await House.create({ farm_id: farm._id, name: 'Nhà 2' })
    const secondCam = await CameraNode.create({ device_id: `cam-${seq}-n2`, house_id: second._id })
    await eveningRates(secondCam._id, second._id, days)

    expect(await checkReturnRateDrops('2026-10-15')).toBe(2)
    const alerts = await Alert.find({ type: 'LOW_RETURN_RATE' }).sort({ house_id: 1 }).lean()
    expect(alerts.map(a => String(a.house_id)).sort()).toEqual([String(house._id), String(second._id)].sort())
    expect(alerts.find(a => String(a.house_id) === String(house._id))!.metadata).toMatchObject({ returnRate: 30, avg: 45 })
  })

  it('thiết bị không được tự gửi LOW_RETURN_RATE', async () => {
    const { camera } = await seed()
    await expect(ingestDeviceAlert({ deviceId: camera.device_id, type: 'LOW_RETURN_RATE' })).rejects.toThrow()
  })
})

describe('nút AI: heartbeat, offline, vision/alert (THREAT-FR-010)', () => {
  it('heartbeat đặt ONLINE + model_version; im quá ngưỡng → OFFLINE + EDGE_AI_DEGRADED của nhà; quay lại thì đóng', async () => {
    const { camera, house } = await seed()
    await CameraNode.updateOne({ _id: camera._id }, { status: 'PENDING' })
    await recordHeartbeat({ deviceId: camera.device_id, firmwareVersion: 'yolo26n-v1' } as never)
    expect(await CameraNode.findById(camera._id).lean()).toMatchObject({ status: 'ONLINE', model_version: 'yolo26n-v1' })
    expect(emitHouseDeviceStatusChange).toHaveBeenLastCalledWith(String(house._id), expect.objectContaining({ status: 'ONLINE' }))

    await CameraNode.updateOne({ _id: camera._id }, { last_heartbeat: new Date(Date.now() - CAMERA_OFFLINE_THRESHOLD_MS - 1000) })
    await markStaleDevicesOffline()
    expect((await CameraNode.findById(camera._id).lean())!.status).toBe('OFFLINE')
    expect(emitHouseDeviceStatusChange).toHaveBeenLastCalledWith(String(house._id), expect.objectContaining({ status: 'OFFLINE' }))
    const alert = (await Alert.findOne({ type: 'EDGE_AI_DEGRADED' }).lean())!
    expect(alert).toMatchObject({ severity: 'MEDIUM', status: 'ACTIVE', house_id: house._id, node_id: camera._id })
    expect(alert.zone_id).toBeUndefined()

    await recordHeartbeat({ deviceId: camera.device_id } as never)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('đang có EDGE_AI_DEGRADED do FPS thấp rồi mất heartbeat → đóng cảnh báo FPS, tạo cảnh báo mất kết nối mới', async () => {
    const { camera } = await seed()
    const fps = (await ingestDeviceAlert({ deviceId: camera.device_id, type: 'EDGE_AI_DEGRADED', message: 'FPS 6' }))!
    await CameraNode.updateOne({ _id: camera._id }, { last_heartbeat: new Date(Date.now() - CAMERA_OFFLINE_THRESHOLD_MS - 1000) })
    await markStaleDevicesOffline()

    expect((await Alert.findById(fps._id).lean())!.status).toBe('RESOLVED')
    const offline = await Alert.find({ type: 'EDGE_AI_DEGRADED', status: 'ACTIVE' }).lean()
    expect(offline).toHaveLength(1)
    expect(offline[0].title).toContain('mất kết nối')
  })

  it('lỗi khi quét SensorNode không làm bỏ qua lượt quét camera', async () => {
    const { camera, zone } = await seed()
    const stale = new Date(Date.now() - CAMERA_OFFLINE_THRESHOLD_MS - 1000)
    await SensorNode.create({ device_id: `ESP-${seq}`, zone_id: zone._id, status: 'ONLINE', last_heartbeat: new Date(0) })
    await CameraNode.updateOne({ _id: camera._id }, { last_heartbeat: stale })
    jest.spyOn(SensorNode, 'updateOne').mockRejectedValueOnce(new Error('Mongo tạm lỗi') as never)

    await expect(markStaleDevicesOffline()).rejects.toThrow('Mongo tạm lỗi')
    expect((await CameraNode.findById(camera._id).lean())!.status).toBe('OFFLINE')
  })

  it('chưa quá 90 giây thì vẫn ONLINE', async () => {
    const { camera } = await seed()
    await CameraNode.updateOne({ _id: camera._id }, { last_heartbeat: new Date(Date.now() - 60_000) })
    await markStaleDevicesOffline()
    expect((await CameraNode.findById(camera._id).lean())!.status).toBe('ONLINE')
  })

  it('vision/alert: nút AI báo được EDGE_AI_DEGRADED gắn nhà, loại khác bị từ chối', async () => {
    const { camera, house } = await seed()
    const alert = await ingestDeviceAlert({ deviceId: camera.device_id, type: 'EDGE_AI_DEGRADED', message: 'FPS 6' })
    expect(alert).toMatchObject({ type: 'EDGE_AI_DEGRADED', node_id: camera._id, house_id: house._id, title: `EDGE_AI_DEGRADED tại ${house.name}` })
    await expect(ingestDeviceAlert({ deviceId: camera.device_id, type: 'PUMP_DRY' })).rejects.toThrow()
  })

  it('GET /devices/camera-nodes theo houseId (hoặc zoneId cũ), không trả rtsp_url', async () => {
    const { house, zone, token } = await seed()
    const other = await seed()
    const all = await get('/devices/camera-nodes', token, {}).expect(200)
    expect(all.body.data).toHaveLength(1)                     // chỉ camera của farm mình
    expect(all.body.data[0]).not.toHaveProperty('rtsp_url')
    expect(all.body.data[0].house_id).toBe(String(house._id))
    expect((await get('/devices/camera-nodes', token, { zoneId: String(zone._id) }).expect(200)).body.data).toHaveLength(1)
    await get('/devices/camera-nodes', token, { houseId: String(other.house._id) }).expect(403)
  })
})
