/**
 * VISION-FR-006/008/009/011/017, THREAT-FR-010 — số đếm chim từ nút AI qua MQTT, tỷ lệ chim
 * về trên số ròng, cảnh báo LOW_RETURN_RATE, số đếm 5 phút, heartbeat/offline của nút AI.
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
import { CameraNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { ingestDeviceAlert } from '@/services/alert.service'
import { checkReturnRateDrops, ingestBirdCount } from '@/services/birdCount.service'
import { CAMERA_OFFLINE_THRESHOLD_MS, markStaleDevicesOffline, recordHeartbeat } from '@/services/device.service'
import { emitBirdCountUpdate, emitDeviceStatusChange } from '@/socket'
import type { BirdCountPayload } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitBirdCountUpdate: jest.fn(), emitDeviceStatusChange: jest.fn(), emitNotificationNew: jest.fn(),
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
  await Promise.all([Alert, BirdCountBucket, BirdCountRecord, CameraNode, Farm, House, Zone, User]
    .map(m => (m as typeof User).deleteMany({})))
})

let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const house = await House.create({ farm_id: farm._id, name: 'H' })
  const zone = await Zone.create({ house_id: house._id, name: 'Z' })
  const camera = await CameraNode.create({ device_id: `cam-${seq}`, zone_id: zone._id, rtsp_url: 'rtsp://admin:secret@10.0.0.2/s', status: 'ONLINE', last_heartbeat: new Date() })
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  return { owner, farm, zone, camera, token }
}

/** 2026-10-15 theo giờ VN, `hh:mm` giờ VN → epoch ms */
const vnAt = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`).getTime()
const session = (deviceId: string, session_type: 'MORNING_EXIT' | 'EVENING_ENTRY', exit_count: number, entry_count: number, timestamp: number): BirdCountPayload =>
  ({ deviceId, session_type, exit_count, entry_count, confidence_avg: 0.8, timestamp })

describe('ingestBirdCount — tin của phiên (VISION-FR-006/008/009)', () => {
  it('upsert 1 bản ghi mỗi (camera, phiên, ngày) và phát BIRD_COUNT_UPDATE', async () => {
    const { camera, zone } = await seed()
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 50, 2, vnAt('2026-10-15', '05:45')))
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 110, 10, vnAt('2026-10-15', '06:30')))

    const records = await BirdCountRecord.find().lean()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ session_date: '2026-10-15', exit_count: 110, entry_count: 10 })
    expect(emitBirdCountUpdate).toHaveBeenLastCalledWith(String(zone._id), expect.objectContaining({ exitCount: 110, sessionType: 'MORNING_EXIT' }))
  })

  it('tỷ lệ chim về tính trên số ròng: (95 − 10) / (110 − 10) = 85%', async () => {
    const { camera } = await seed()
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 110, 10, vnAt('2026-10-15', '06:30')))
    await ingestBirdCount(session(camera.device_id, 'EVENING_ENTRY', 10, 95, vnAt('2026-10-15', '18:30')))

    const evening = await BirdCountRecord.findOne({ session_type: 'EVENING_ENTRY' }).lean()
    expect(evening).toMatchObject({ return_rate: 85, entry_count: 95, exit_count: 10 })
  })

  it('chưa có phiên sáng thì chưa có return_rate', async () => {
    const { camera } = await seed()
    await ingestBirdCount(session(camera.device_id, 'EVENING_ENTRY', 0, 80, vnAt('2026-10-15', '18:30')))
    expect((await BirdCountRecord.findOne().lean())!.return_rate).toBeUndefined()
  })

  it('từ chối payload sai, không ghi DB', async () => {
    const { camera } = await seed()
    await expect(ingestBirdCount(session('cam-khong-co', 'MORNING_EXIT', 1, 0, Date.now()))).rejects.toThrow()
    await expect(ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', -1, 0, Date.now()))).rejects.toThrow()
    await expect(ingestBirdCount({ ...session(camera.device_id, 'MORNING_EXIT', 1, 0, Date.now()), session_type: 'NOON' as never })).rejects.toThrow()
    expect(await BirdCountRecord.countDocuments()).toBe(0)
  })

  it('/daily gom phiên sáng (22:30 UTC hôm trước) và phiên chiều vào cùng 1 ngày VN', async () => {
    const { camera, zone, token } = await seed()
    await ingestBirdCount(session(camera.device_id, 'MORNING_EXIT', 100, 0, vnAt('2026-10-15', '05:31')))
    await ingestBirdCount(session(camera.device_id, 'EVENING_ENTRY', 0, 90, vnAt('2026-10-15', '18:00')))

    const res = await request(app).get('/analytics/bird-count/daily')
      .query({ zoneId: String(zone._id), from: '2026-10-14T00:00:00Z', to: '2026-10-16T00:00:00Z' })
      .set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data.records).toEqual([{ date: '2026-10-15', morning_exit: 100, evening_entry: 90, return_rate: 90 }])
  })
})

describe('số đếm 5 phút (VISION-FR-017)', () => {
  const bucket = (deviceId: string, at: string, entry_count: number, exit_count: number): BirdCountPayload =>
    ({ deviceId, kind: 'BUCKET', bucket_start: new Date(at).getTime(), bucket_minutes: 5, entry_count, exit_count })

  it('upsert theo bucket_start, không tạo bản ghi phiên', async () => {
    const { camera } = await seed()
    await ingestBirdCount(bucket(camera.device_id, '2026-10-15T10:00:00Z', 3, 1))
    await ingestBirdCount(bucket(camera.device_id, '2026-10-15T10:00:00Z', 4, 2))
    expect(await BirdCountBucket.find().lean()).toEqual([expect.objectContaining({ entry_count: 4, exit_count: 2 })])
    expect(await BirdCountRecord.countDocuments()).toBe(0)
    await expect(ingestBirdCount({ ...bucket(camera.device_id, '2026-10-15T10:00:00Z', 1, 1), bucket_start: undefined })).rejects.toThrow()
  })

  it('/buckets cộng các camera của Zone; khoảng quá 7 ngày → 400; farm khác → 403', async () => {
    const { camera, zone, token } = await seed()
    const second = await CameraNode.create({ device_id: `cam-${seq}-b`, zone_id: zone._id })
    await ingestBirdCount(bucket(camera.device_id, '2026-10-15T10:00:00Z', 3, 1))
    await ingestBirdCount(bucket(second.device_id, '2026-10-15T10:00:00Z', 2, 2))
    await ingestBirdCount(bucket(camera.device_id, '2026-10-15T10:05:00Z', 1, 0))

    const get = (t: string, q: object) => request(app).get('/analytics/bird-count/buckets').query({ zoneId: String(zone._id), ...q }).set('Authorization', `Bearer ${t}`)
    const res = await get(token, { from: '2026-10-15T09:00:00Z', to: '2026-10-15T11:00:00Z' }).expect(200)
    expect(res.body.data.buckets).toEqual([
      { bucket_start: '2026-10-15T10:00:00.000Z', entry_count: 5, exit_count: 3 },
      { bucket_start: '2026-10-15T10:05:00.000Z', entry_count: 1, exit_count: 0 },
    ])

    await get(token, { from: '2026-10-01T00:00:00Z', to: '2026-10-15T00:00:00Z' }).expect(400)
    const stranger = await seed()
    await get(stranger.token, { from: '2026-10-15T09:00:00Z', to: '2026-10-15T11:00:00Z' }).expect(403)
  })
})

describe('checkReturnRateDrops (VISION-FR-011)', () => {
  async function eveningRates(cameraId: unknown, zoneId: unknown, rates: Array<[string, number]>) {
    await BirdCountRecord.create(rates.map(([session_date, return_rate]) => ({
      camera_node_id: cameraId, zone_id: zoneId, session_type: 'EVENING_ENTRY', session_date,
      timestamp: new Date(`${session_date}T11:00:00Z`), entry_count: 90, exit_count: 0, return_rate,
    })))
  }

  it('3 ngày trước 90%, hôm nay 60% → LOW_RETURN_RATE; chạy lại không tạo thêm; hồi lại thì đóng', async () => {
    const { camera, zone } = await seed()
    await eveningRates(camera._id, zone._id, [['2026-10-12', 90], ['2026-10-13', 90], ['2026-10-14', 90], ['2026-10-15', 60]])

    expect(await checkReturnRateDrops('2026-10-15')).toBe(1)
    expect(await checkReturnRateDrops('2026-10-15')).toBe(0)
    const alert = (await Alert.findOne({ type: 'LOW_RETURN_RATE' }).lean())!
    expect(alert).toMatchObject({ severity: 'LOW', status: 'ACTIVE', node_id: camera._id })
    expect(alert.metadata).toMatchObject({ dropPct: 33.3, limit: 20 })

    await eveningRates(camera._id, zone._id, [['2026-10-16', 88]])
    expect(await checkReturnRateDrops('2026-10-16')).toBe(0)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('dùng return_rate_drop_pct của Zone và cần ít nhất 3 ngày nền', async () => {
    const { camera, zone } = await seed()
    await Zone.updateOne({ _id: zone._id }, { 'detection_tuning.return_rate_drop_pct': 40 })
    await eveningRates(camera._id, zone._id, [['2026-10-12', 90], ['2026-10-13', 90], ['2026-10-14', 90], ['2026-10-15', 60]])
    expect(await checkReturnRateDrops('2026-10-15')).toBe(0)

    const other = await seed()
    await eveningRates(other.camera._id, other.zone._id, [['2026-10-13', 90], ['2026-10-14', 90], ['2026-10-15', 10]])
    expect(await checkReturnRateDrops('2026-10-15')).toBe(0)
  })

  it('thiết bị không được tự gửi LOW_RETURN_RATE', async () => {
    const { camera } = await seed()
    await expect(ingestDeviceAlert({ deviceId: camera.device_id, type: 'LOW_RETURN_RATE' })).rejects.toThrow()
  })
})

describe('nút AI: heartbeat, offline, vision/alert (THREAT-FR-010)', () => {
  it('heartbeat đặt ONLINE + model_version; im quá ngưỡng → OFFLINE + EDGE_AI_DEGRADED; quay lại thì đóng', async () => {
    const { camera } = await seed()
    await CameraNode.updateOne({ _id: camera._id }, { status: 'PENDING' })
    await recordHeartbeat({ deviceId: camera.device_id, firmwareVersion: 'yolov8n-v1' } as never)
    expect(await CameraNode.findById(camera._id).lean()).toMatchObject({ status: 'ONLINE', model_version: 'yolov8n-v1' })

    await CameraNode.updateOne({ _id: camera._id }, { last_heartbeat: new Date(Date.now() - CAMERA_OFFLINE_THRESHOLD_MS - 1000) })
    await markStaleDevicesOffline()
    expect((await CameraNode.findById(camera._id).lean())!.status).toBe('OFFLINE')
    expect(emitDeviceStatusChange).toHaveBeenLastCalledWith(String(camera.zone_id), expect.objectContaining({ status: 'OFFLINE' }))
    const alert = (await Alert.findOne({ type: 'EDGE_AI_DEGRADED' }).lean())!
    expect(alert).toMatchObject({ severity: 'MEDIUM', status: 'ACTIVE' })

    await recordHeartbeat({ deviceId: camera.device_id } as never)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
  })

  it('chưa quá 90 giây thì vẫn ONLINE', async () => {
    const { camera } = await seed()
    await CameraNode.updateOne({ _id: camera._id }, { last_heartbeat: new Date(Date.now() - 60_000) })
    await markStaleDevicesOffline()
    expect((await CameraNode.findById(camera._id).lean())!.status).toBe('ONLINE')
  })

  it('vision/alert: nút AI báo được EDGE_AI_DEGRADED, loại khác bị từ chối', async () => {
    const { camera } = await seed()
    const alert = await ingestDeviceAlert({ deviceId: camera.device_id, type: 'EDGE_AI_DEGRADED', message: 'FPS 6' })
    expect(alert).toMatchObject({ type: 'EDGE_AI_DEGRADED', node_id: camera._id })
    await expect(ingestDeviceAlert({ deviceId: camera.device_id, type: 'PUMP_DRY' })).rejects.toThrow()
  })

  it('GET /devices/camera-nodes không trả rtsp_url', async () => {
    const { token } = await seed()
    const res = await request(app).get('/devices/camera-nodes').set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).not.toHaveProperty('rtsp_url')
  })
})
