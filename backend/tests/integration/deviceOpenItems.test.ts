import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
import deviceRoutes from '@/routes/devices.route'
import workOrderRoutes from '@/routes/workOrders.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { CameraNode, SensorNode } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { User } from '@/models/user.model'
import { WorkOrder } from '@/models/workOrder.model'
import { createAlert } from '@/services/alert.service'
import { createProvisionedDevice } from '@/services/provisionedDevice.service'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/socket', () => ({
  emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitHouseDeviceStatusChange: jest.fn(), emitRelayUpdate: jest.fn(),
}))
jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/config/minio.config', () => ({ putObject: jest.fn(), presignedGetUrl: jest.fn() }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/alerts', alertRoutes)
app.use('/work-orders', workOrderRoutes)
app.use('/devices', deviceRoutes)
app.use(errorHandler)

useTestDb()

afterEach(async () => {
  await Promise.all([CameraNode.deleteMany({}), ProvisionedDevice.deleteMany({})])
})

let seq = 0
async function account(role: 'FARM_TECHNICIAN' | 'ADMIN') {
  seq++
  const user = await User.create({ email: `open${seq}@test.vn`, password_hash: 'password123', full_name: `${role}${seq}`, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

// Nhà H (thợ được giao) có hai bộ điều khiển và một camera; nhà H2 do thợ khác giữ
async function seed() {
  const ctx = await seedOwnerFarm()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  const house2 = await House.create({ farm_id: ctx.farm._id, name: 'H2' })
  const zone2 = await Zone.create({ house_id: house2._id, name: 'Z2' })
  const [tech, other, admin] = [await account('FARM_TECHNICIAN'), await account('FARM_TECHNICIAN'), await account('ADMIN')]
  ctx.farm.members.push({ user_id: tech.user._id, role: 'FARM_TECHNICIAN' } as never, { user_id: other.user._id, role: 'FARM_TECHNICIAN' } as never)
  await ctx.farm.save()
  house.technicians = [{ user_id: tech.user._id, primary: true }] as never
  await house.save()
  house2.technicians = [{ user_id: other.user._id, primary: true }] as never
  await house2.save()
  const second = await SensorNode.create({ device_id: `ESP-second-${seq}`, zone_id: ctx.zone._id, status: 'ONLINE' })
  const farNode = await SensorNode.create({ device_id: `ESP-far-${seq}`, zone_id: zone2._id, status: 'ONLINE' })
  const camera = await CameraNode.create({ device_id: `cam-${seq}`, house_id: house._id, status: 'ONLINE' })
  const raise = (nodeId: unknown, type: 'SENSOR_FAULT' | 'NODE_OFFLINE', zoneId = ctx.zone._id) => createAlert({
    farmId: String(ctx.farm._id), zoneId: String(zoneId), nodeId: String(nodeId), type, title: `${type}`, message: 'chi tiết',
  })
  return { ...ctx, house, house2, tech, other, admin, second, farNode, camera, raise }
}

describe('cảnh báo và phiếu công việc theo thiết bị (FARM-FR-015)', () => {
  it('cảnh báo chỉ của đúng thiết bị được hỏi, kể cả camera', async () => {
    const { token, node, second, camera, farm, house, raise } = await seed()
    await raise(node._id, 'SENSOR_FAULT')
    await raise(second._id, 'NODE_OFFLINE')
    await createAlert({ farmId: String(farm._id), houseId: String(house._id), nodeId: String(camera._id), type: 'EDGE_AI_DEGRADED', title: 'c', message: 'c' })

    const first = await request(app).get(`/alerts?nodeId=${node._id}`).set(auth(token)).expect(200)
    expect(first.body.data.map((a: { type: string }) => a.type)).toEqual(['SENSOR_FAULT'])
    const offline = await request(app).get(`/alerts?nodeId=${second._id}&open=true`).set(auth(token)).expect(200)
    expect(offline.body.data.map((a: { type: string }) => a.type)).toEqual(['NODE_OFFLINE'])
    const cam = await request(app).get(`/alerts?nodeId=${camera._id}`).set(auth(token)).expect(200)
    expect(cam.body.data.map((a: { type: string }) => a.type)).toEqual(['EDGE_AI_DEGRADED'])
  })

  it('phiếu công việc chỉ của đúng thiết bị; thiết bị không có việc thì danh sách rỗng', async () => {
    const { token, node, second, raise } = await seed()
    await raise(node._id, 'SENSOR_FAULT')
    const empty = await request(app).get(`/work-orders?nodeId=${second._id}`).set(auth(token)).expect(200)
    expect(empty.body.data).toEqual([])

    const res = await request(app).get(`/work-orders?nodeId=${node._id}&open=true`).set(auth(token)).expect(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({ alert_type: 'SENSOR_FAULT', node_id: String(node._id) })
  })

  it('thợ của nhà được giao xem được; thợ nhà khác 403; thiết bị không có 404; Administrator xem cảnh báo thiết bị', async () => {
    const { node, camera, tech, other, admin, raise } = await seed()
    await raise(node._id, 'SENSOR_FAULT')

    for (const path of [`/alerts?nodeId=${node._id}`, `/work-orders?nodeId=${node._id}`, `/alerts?nodeId=${camera._id}`]) {
      await request(app).get(path).set(auth(tech.token)).expect(200)
    }
    for (const path of [`/alerts?nodeId=${node._id}`, `/work-orders?nodeId=${node._id}`, `/alerts?nodeId=${camera._id}`, `/work-orders?nodeId=${camera._id}`]) {
      const denied = await request(app).get(path).set(auth(other.token)).expect(403)
      expect(denied.body.success).toBe(false)
    }
    const missing = String(new mongoose.Types.ObjectId())
    await request(app).get(`/alerts?nodeId=${missing}`).set(auth(tech.token)).expect(404)
    await request(app).get(`/work-orders?nodeId=${missing}`).set(auth(tech.token)).expect(404)
    await request(app).get(`/alerts?nodeId=${node._id}`).set(auth(admin.token)).expect(200)
  })

  it('nodeId không phải id hợp lệ, hoặc lặp lại thành mảng → 422', async () => {
    const { token, node } = await seed()
    await request(app).get('/alerts?nodeId=abc').set(auth(token)).expect(422)
    await request(app).get(`/work-orders?nodeId=${node._id}&nodeId=${node._id}`).set(auth(token)).expect(422)
  })

  it('thiết bị đã gỡ vẫn xem được lịch sử việc của nó', async () => {
    const { token, node, raise } = await seed()
    await raise(node._id, 'SENSOR_FAULT')
    await SensorNode.updateOne({ _id: node._id }, { decommissioned_at: new Date() })
    const res = await request(app).get(`/work-orders?nodeId=${node._id}`).set(auth(token)).expect(200)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('thay bộ điều khiển có phiếu đang mở', () => {
  it('phiếu còn mở của máy cũ ghi một dòng lịch sử "đã thay bằng"; trạng thái phiếu không đổi; phiếu của máy khác không bị ghi', async () => {
    const { node, second, raise, tech } = await seed()
    await raise(node._id, 'SENSOR_FAULT')
    await raise(second._id, 'SENSOR_FAULT')
    const key = (await createProvisionedDevice(String(new mongoose.Types.ObjectId()), { device_id: 'ESP-new', kind: 'SENSOR' })).secret_key

    await request(app).post(`/devices/sensor-nodes/${node._id}/replace`).set(auth(tech.token))
      .send({ new_device_id: 'ESP-new', secret_key: key, reason: 'Hỏng nguồn' }).expect(201)

    const replaced = (await WorkOrder.findOne({ node_id: node._id }).lean())!
    const noted = replaced.history.filter(entry => entry.note?.includes('đã được thay bằng ESP-new'))
    expect(noted).toHaveLength(1)
    expect(noted[0]).toMatchObject({ from: replaced.status, to: replaced.status })
    expect(String(noted[0].by)).toBe(String(tech.user._id))

    const untouched = (await WorkOrder.findOne({ node_id: second._id }).lean())!
    expect(untouched.history.some(entry => entry.note?.includes('đã được thay bằng'))).toBe(false)
  })

  it('thay thiết bị không có phiếu nào vẫn thành công', async () => {
    const { node, tech } = await seed()
    const key = (await createProvisionedDevice(String(new mongoose.Types.ObjectId()), { device_id: 'ESP-new2', kind: 'SENSOR' })).secret_key
    await request(app).post(`/devices/sensor-nodes/${node._id}/replace`).set(auth(tech.token))
      .send({ new_device_id: 'ESP-new2', secret_key: key, reason: 'Hỏng' }).expect(201)
  })
})
