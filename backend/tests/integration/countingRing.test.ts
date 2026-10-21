/**
 * VISION-FR-018 — vòng đếm của camera do Domain Expert vẽ: kiểm dữ liệu, lịch sử + audit, gửi xuống
 * nút AI qua `config/update` của nhà, và gửi lại khi nút AI vừa kết nối lại (tin không retained).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import deviceRoutes from '@/routes/devices.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { CameraNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { publishHouseCommand } from '@/mqtt/mqtt.client'
import { recordHeartbeat } from '@/services/device.service'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true), publishHouseCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitHouseDeviceStatusChange: jest.fn() }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
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
  ;(publishHouseCommand as jest.Mock).mockReturnValue(true)
  await Promise.all([AuditLog, CameraNode, Farm, House, User].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

// Vòng đo ngày 21/10/2026 ở nhà yến thử nghiệm (docs/bird-counting-plan.md 19.8)
const RING = [[0.379, 0.228], [0.527, 0.136], [0.575, 0.277], [0.569, 0.374], [0.427, 0.477], [0.386, 0.334]]

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
  const camera = await CameraNode.create({ device_id: `cam_${seq}`, house_id: house._id, status: 'ONLINE', rtsp_url: 'rtsp://admin:secret@cam/1' })
  const put = (token: string, body: object, id: unknown = camera._id) =>
    request(app).put(`/devices/camera-nodes/${id}/counting-ring`).set('Authorization', `Bearer ${token}`).send(body)
  return { owner, expert, farm, house, camera, put, t: { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT') } }
}

describe('PUT /devices/camera-nodes/:id/counting-ring', () => {
  it('Domain Expert lưu vòng kèm lịch sử + audit, gửi xuống nút AI theo nhà, không lộ rtsp_url', async () => {
    const { farm, house, camera, expert, put, t } = await seed()

    const res = await put(t.expert, { points: RING, into_ring_is_exit: true, extra: 1 }).expect(200)
    expect(res.body.data.rtsp_url).toBeUndefined()
    expect(res.body.data.ring_delivered).toBe(true)
    expect(publishHouseCommand).toHaveBeenCalledWith(String(farm._id), String(house._id), 'config/update',
      { deviceId: camera.device_id, counting_ring: { points: RING, into_ring_is_exit: true } })

    await put(t.expert, { points: RING.slice(0, 3), into_ring_is_exit: false }).expect(200)
    const saved = (await CameraNode.findById(camera._id))!.toObject()
    expect(saved.counting_ring).toMatchObject({ points: RING.slice(0, 3), into_ring_is_exit: false, updated_by: expert._id })
    expect(saved.counting_ring_history).toHaveLength(2)
    expect(saved.counting_ring_history[0]).toMatchObject({ changed_by_role: 'DOMAIN_EXPERT', new_value: { points: RING } })
    expect(saved.counting_ring_history[0].old_value).toBeUndefined()
    expect(saved.counting_ring_history[1].old_value).toEqual({ points: RING, into_ring_is_exit: true })
    expect(await AuditLog.countDocuments({ action: 'COUNTING_RING_UPDATED', target_id: camera._id })).toBe(2)
  })

  it('Farm Owner chỉ xem; chuyên gia farm khác không sửa được', async () => {
    const { camera, put, t } = await seed()
    await put(t.owner, { points: RING, into_ring_is_exit: true }).expect(403)
    const other = await seed()
    await other.put(other.t.expert, { points: RING, into_ring_is_exit: true }, camera._id).expect(403)
    expect(publishHouseCommand).not.toHaveBeenCalled()
  })

  it.each([
    ['2 đỉnh', { points: RING.slice(0, 2), into_ring_is_exit: true }],
    ['13 đỉnh', { points: [...RING, ...RING, RING[0]], into_ring_is_exit: true }],
    ['toạ độ ngoài 0-1', { points: [[0.1, 0.1], [1.2, 0.1], [0.5, 0.9]], into_ring_is_exit: true }],
    ['đỉnh không phải [x, y]', { points: [[0.1], [0.2, 0.2], [0.5, 0.9]], into_ring_is_exit: true }],
    ['chiều đếm là chuỗi', { points: RING, into_ring_is_exit: 'true' }],
    ['thiếu chiều đếm', { points: RING }],
  ])('từ chối %s', async (_name, body) => {
    const { put, t } = await seed()
    await put(t.expert, body).expect(422)
    expect(publishHouseCommand).not.toHaveBeenCalled()
  })

  it('broker mất kết nối vẫn lưu, báo ring_delivered=false; camera đã gỡ thì 409', async () => {
    const { camera, put, t } = await seed()
    ;(publishHouseCommand as jest.Mock).mockReturnValue(false)
    const res = await put(t.expert, { points: RING, into_ring_is_exit: true }).expect(200)
    expect(res.body.data.ring_delivered).toBe(false)
    expect((await CameraNode.findById(camera._id))!.counting_ring).toBeDefined()

    await CameraNode.updateOne({ _id: camera._id }, { decommissioned_at: new Date() })
    await put(t.expert, { points: RING, into_ring_is_exit: true }).expect(409)
  })
})

describe('gửi lại vòng đếm khi nút AI kết nối lại', () => {
  it('nút AI vừa online lại hoặc báo justConnected thì nhận lại vòng; heartbeat thường thì không', async () => {
    const { camera, put, t } = await seed()
    await put(t.expert, { points: RING, into_ring_is_exit: true }).expect(200)
    jest.clearAllMocks()

    await recordHeartbeat({ deviceId: camera.device_id } as never)
    expect(publishHouseCommand).not.toHaveBeenCalled()

    await CameraNode.updateOne({ _id: camera._id }, { status: 'OFFLINE' })
    await recordHeartbeat({ deviceId: camera.device_id } as never)
    await recordHeartbeat({ deviceId: camera.device_id, justConnected: true } as never)
    expect(publishHouseCommand).toHaveBeenCalledTimes(2)
    expect((publishHouseCommand as jest.Mock).mock.calls[0][3]).toMatchObject({ deviceId: camera.device_id, counting_ring: { points: RING } })
  })

  it('camera chưa có vòng do chuyên gia vẽ thì không gửi gì (pipeline dùng config.yaml)', async () => {
    const { camera } = await seed()
    await CameraNode.updateOne({ _id: camera._id }, { status: 'OFFLINE' })
    await recordHeartbeat({ deviceId: camera.device_id, justConnected: true } as never)
    expect(publishHouseCommand).not.toHaveBeenCalled()
  })
})
