import express from 'express'
import request from 'supertest'
import deviceRoutes from '@/routes/devices.route'
import adminRoutes from '@/routes/admin.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { User } from '@/models/user.model'
import { createProvisionedDevice } from '@/services/provisionedDevice.service'
import { notifyUser } from '@/services/notification.service'
import { useTestDb, seedOwnerFarm } from '../helpers/ownerFarm'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use('/admin', adminRoutes)
app.use(errorHandler)

useTestDb()

afterEach(async () => {
  await Promise.all([CameraNode.deleteMany({}), ProvisionedDevice.deleteMany({}), AuditLog.deleteMany({})])
})

let seq = 0

// Farm có nhà H (có thợ được giao) và nhà thứ hai H2 không giao cho thợ
async function seed() {
  const ctx = await seedOwnerFarm()
  seq++
  const tech = await User.create({ email: `tech${seq}@test.vn`, password_hash: 'password123', full_name: 'T', role: 'FARM_TECHNICIAN' })
  ctx.farm.members.push({ user_id: tech._id, role: 'FARM_TECHNICIAN' } as never)
  await ctx.farm.save()
  const house = (await House.findOne({ farm_id: ctx.farm._id }))!
  house.technicians = [{ user_id: tech._id, primary: true }] as never
  await house.save()
  const otherHouse = await House.create({ farm_id: ctx.farm._id, name: 'H2' })
  const otherZone = await Zone.create({ house_id: otherHouse._id, name: 'Z2' })
  const secondZone = await Zone.create({ house_id: house._id, name: 'Z1b' })
  const techToken = jwt.sign({ sub: String(tech._id), role: 'FARM_TECHNICIAN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  return { ...ctx, tech, techToken, house, otherHouse, otherZone, secondZone }
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function stockKey(deviceId: string, kind: 'SENSOR' | 'CAMERA') {
  return (await createProvisionedDevice(String(new mongoose.Types.ObjectId()), { device_id: deviceId, kind })).secret_key
}

describe('Kỹ thuật viên đăng ký thiết bị ở nhà được giao (FARM-FR-003, 004)', () => {
  it('đăng ký controller vào Zone của nhà được giao: PENDING, ghi audit và báo Farm Owner; Zone nhà khác → 403', async () => {
    const { techToken, tech, zone, otherZone } = await seed()
    const key = await stockKey('tech_node_1', 'SENSOR')

    const denied = await request(app).post('/devices/sensor-nodes/register').set(auth(techToken))
      .send({ device_id: 'tech_node_1', zone_id: String(otherZone._id), secret_key: key }).expect(403)
    expect(denied.body.success).toBe(false)
    expect(denied.body.error.code).toBe('SETUP_LOCATION_NOT_ALLOWED')
    expect(await SensorNode.findOne({ device_id: 'tech_node_1' })).toBeNull()

    const res = await request(app).post('/devices/sensor-nodes/register').set(auth(techToken))
      .send({ device_id: 'tech_node_1', zone_id: String(zone._id), secret_key: key }).expect(201)
    expect(res.body.data.status).toBe('PENDING')
    expect(String(res.body.data.registered_by)).toBe(String(tech._id))
    expect(await AuditLog.countDocuments({ action: 'DEVICE_REGISTERED' })).toBe(1)
    expect(notifyUser).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ title: 'Kỹ thuật viên đã đăng ký thiết bị' }))
  })

  it('thợ không được giao nhà nào, hoặc không thuộc farm → 403', async () => {
    const { techToken, zone, house } = await seed()
    await House.updateOne({ _id: house._id }, { technicians: [] })
    const key = await stockKey('tech_node_2', 'SENSOR')
    await request(app).post('/devices/sensor-nodes/register').set(auth(techToken))
      .send({ device_id: 'tech_node_2', zone_id: String(zone._id), secret_key: key }).expect(403)
  })

  it('đăng ký camera đếm chim vào nhà được giao, nhà khác → 403', async () => {
    const { techToken, house, otherHouse } = await seed()
    const key = await stockKey('tech_cam_1', 'CAMERA')
    await request(app).post('/devices/camera-nodes/register').set(auth(techToken))
      .send({ device_id: 'tech_cam_1', house_id: String(otherHouse._id), secret_key: key }).expect(403)
    const res = await request(app).post('/devices/camera-nodes/register').set(auth(techToken))
      .send({ device_id: 'tech_cam_1', house_id: String(house._id), secret_key: key }).expect(201)
    expect(res.body.data.status).toBe('PENDING')
  })

  it('Domain Expert vẫn bị từ chối', async () => {
    const { zone, farm } = await seed()
    const expert = await User.create({ email: 'expert-dev@test.vn', password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
    farm.members.push({ user_id: expert._id, role: 'DOMAIN_EXPERT' } as never)
    await farm.save()
    const token = jwt.sign({ sub: String(expert._id), role: 'DOMAIN_EXPERT' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
    const key = await stockKey('tech_node_3', 'SENSOR')
    await request(app).post('/devices/sensor-nodes/register').set(auth(token))
      .send({ device_id: 'tech_node_3', zone_id: String(zone._id), secret_key: key }).expect(403)
  })
})

describe('Kỹ thuật viên dời, gỡ, thay và khôi phục (FARM-FR-007b, 008)', () => {
  it('dời trong nhà được giao: được và báo Farm Owner; sang Zone nhà khác, hoặc thiết bị ở nhà khác → 403', async () => {
    const { techToken, node, secondZone, otherZone } = await seed()
    const put = (id: unknown, zone: { _id: unknown }) => request(app).put(`/devices/sensor-nodes/${id}/reassign-zone`)
      .set(auth(techToken)).send({ newZoneId: String(zone._id) })

    await put(node._id, otherZone).expect(403)
    expect(String((await SensorNode.findById(node._id))!.zone_id)).toBe(String(node.zone_id))

    await put(node._id, secondZone).expect(200)
    expect(String((await SensorNode.findById(node._id))!.zone_id)).toBe(String(secondZone._id))
    expect(await AuditLog.countDocuments({ action: 'DEVICE_REASSIGNED' })).toBe(1)
    expect(notifyUser).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ title: 'Kỹ thuật viên đã dời thiết bị' }))

    const foreign = await SensorNode.create({ device_id: 'foreign_1', zone_id: otherZone._id, status: 'OFFLINE' })
    await put(foreign._id, secondZone).expect(403)
  })

  it('gỡ thiết bị nhà được giao rồi khôi phục trong 24 giờ; danh sách đã gỡ chỉ có nhà được giao', async () => {
    const { techToken, node, otherZone } = await seed()
    await SensorNode.updateOne({ _id: node._id }, { status: 'OFFLINE' })
    const foreign = await SensorNode.create({ device_id: 'foreign_2', zone_id: otherZone._id, status: 'OFFLINE', decommissioned_at: new Date() })

    await request(app).post(`/devices/sensor-nodes/${foreign._id}/restore`).set(auth(techToken)).send({ reason: 'thử' }).expect(403)
    await request(app).post(`/devices/sensor-nodes/${node._id}/decommission`).set(auth(techToken)).send({}).expect(422)
    await request(app).post(`/devices/sensor-nodes/${node._id}/decommission`).set(auth(techToken)).send({ reason: 'Hỏng nguồn' }).expect(200)
    expect(await AuditLog.countDocuments({ action: 'DEVICE_DECOMMISSIONED' })).toBe(1)
    expect(notifyUser).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ title: 'Thiết bị đã được gỡ khỏi nhà yến' }))

    const removed = await request(app).get('/devices/sensor-nodes?removed=recent').set(auth(techToken)).expect(200)
    expect(removed.body.data.map((d: { device_id: string }) => d.device_id)).toEqual([node.device_id])

    await request(app).post(`/devices/sensor-nodes/${node._id}/restore`).set(auth(techToken)).send({ reason: 'Gỡ nhầm' }).expect(200)
    expect((await SensorNode.findById(node._id))!.decommissioned_at).toBeUndefined()
  })

  it('gỡ camera ở nhà khác → 403; thay controller đăng ký thiết bị mới vào cùng Zone', async () => {
    const { techToken, node, otherHouse } = await seed()
    const foreignCam = await CameraNode.create({ device_id: 'foreign_cam', house_id: otherHouse._id, status: 'OFFLINE' })
    await request(app).post(`/devices/camera-nodes/${foreignCam._id}/decommission`).set(auth(techToken)).send({ reason: 'x' }).expect(403)

    const key = await stockKey('tech_node_new', 'SENSOR')
    const res = await request(app).post(`/devices/sensor-nodes/${node._id}/replace`).set(auth(techToken))
      .send({ new_device_id: 'tech_node_new', secret_key: key, reason: 'Hỏng' }).expect(201)
    expect(String(res.body.data.newNode.zone_id)).toBe(String(node.zone_id))
    expect((await SensorNode.findById(node._id))!.decommissioned_at).toBeInstanceOf(Date)
  })
})

describe('mỗi lý do đăng ký thất bại có mã lỗi riêng để màn thiết lập nói đúng', () => {
  const registerAs = (token: string, deviceId: string, zoneId: unknown, key: string) =>
    request(app).post('/devices/sensor-nodes/register').set(auth(token)).send({ device_id: deviceId, zone_id: String(zoneId), secret_key: key })

  it('sai mã kích hoạt, thiết bị bị thu hồi', async () => {
    const { techToken, zone } = await seed()
    const key = await stockKey('code_node_1', 'SENSOR')

    const wrong = await registerAs(techToken, 'code_node_1', zone._id, 'AAAA-BBBB-CCCC').expect(400)
    expect(wrong.body.error.code).toBe('INVALID_DEVICE_LABEL')

    await ProvisionedDevice.updateOne({ device_id: 'code_node_1' }, { revoked_at: new Date() })
    const revoked = await registerAs(techToken, 'code_node_1', zone._id, key).expect(409)
    expect(revoked.body.error.code).toBe('DEVICE_REVOKED')
  })

  it('đã đăng ký ở chính trang trại này, hoặc đang dùng ở trang trại khác', async () => {
    const { techToken, zone, secondZone } = await seed()
    const key = await stockKey('code_node_2', 'SENSOR')
    await registerAs(techToken, 'code_node_2', zone._id, key).expect(201)

    const sameFarm = await registerAs(techToken, 'code_node_2', secondZone._id, key).expect(409)
    expect(sameFarm.body.error.code).toBe('DEVICE_ALREADY_REGISTERED')

    const other = await seedOwnerFarm()
    const otherFarm = await registerAs(other.token, 'code_node_2', other.zone._id, key).expect(409)
    expect(otherFarm.body.error.code).toBe('DEVICE_IN_OTHER_FARM')
  })
})
