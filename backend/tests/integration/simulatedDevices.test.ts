/**
 * SYSTEM-FR-004, Report 4 D20 — thiết bị của bộ giả lập: Administrator đánh dấu `simulated` khi nhập
 * kho, cờ đi theo controller và camera khi Farm Owner đăng ký bằng nhãn, để mọi màn hình ghi rõ.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import adminRoutes from '@/routes/admin.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { CameraNode, SensorNode } from '@/models/device.model'
import { House } from '@/models/houseZone.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { User } from '@/models/user.model'
import { registerCameraNode, registerSensorNode } from '@/services/device.service'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/admin', adminRoutes)
app.use(errorHandler)

useTestDb()

afterEach(() => Promise.all([ProvisionedDevice.deleteMany({}), CameraNode.deleteMany({})]))

async function adminToken() {
  const admin = await User.create({ email: `admin${Date.now()}@test.vn`, password_hash: 'password123', full_name: 'A', role: 'ADMIN' })
  return jwt.sign({ sub: String(admin._id), role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
}

const stock = (token: string, body: object) =>
  request(app).post('/admin/provisioned-devices').set('Authorization', `Bearer ${token}`).send(body)

describe('Thiết bị giả lập (SYSTEM-FR-004)', () => {
  it('controller và camera nhập kho với simulated: true mang cờ đó sau khi Farm Owner đăng ký', async () => {
    const token = await adminToken()
    const { user, zone } = await seedOwnerFarm()
    const sensor = await stock(token, { device_id: 'SIM-C001', kind: 'SENSOR', simulated: true })
    const camera = await stock(token, { device_id: 'SIM-A001', kind: 'CAMERA', simulated: true })
    expect(sensor.status).toBe(201)
    expect(sensor.body.data).toMatchObject({ device_id: 'SIM-C001', simulated: true })

    const node = await registerSensorNode(user, { device_id: 'SIM-C001', zone_id: String(zone._id), secret_key: sensor.body.data.secret_key })
    const cam = await registerCameraNode(user, { device_id: 'SIM-A001', house_id: String(zone.house_id), secret_key: camera.body.data.secret_key })

    expect(node.simulated).toBe(true)
    expect(cam.simulated).toBe(true)
    expect((await SensorNode.findById(node._id).lean())!.simulated).toBe(true)
  })

  it('không gửi cờ thì là thiết bị thật', async () => {
    const token = await adminToken()
    const { user, zone } = await seedOwnerFarm()
    const res = await stock(token, { device_id: 'ESP-REAL', kind: 'SENSOR' })
    const node = await registerSensorNode(user, { device_id: 'ESP-REAL', zone_id: String(zone._id), secret_key: res.body.data.secret_key })
    expect(res.body.data.simulated).toBe(false)
    expect(node.simulated).toBe(false)
    expect(await House.countDocuments()).toBe(1)
  })

  it('simulated không phải boolean thì 422', async () => {
    const res = await stock(await adminToken(), { device_id: 'SIM-C002', kind: 'SENSOR', simulated: 'yes' })
    expect(res.status).toBe(422)
    expect(await ProvisionedDevice.countDocuments()).toBe(0)
  })
})
