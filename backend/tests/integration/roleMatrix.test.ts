/**
 * Report 3 §2.4 — ma trận quyền: Farm Technician (kể cả ở nhà được giao), Admin không sửa ngưỡng/hệ số
 * mờ, không sửa lịch loa, không xác nhận cảnh báo, không setup/dời/gỡ thiết bị, không quản lý file loa;
 * Admin không bật relay, không quản lý farm; Farm Owner tự setup thiết bị (MF-10) nhưng chỉ ở farm của
 * mình (FARM-FR-007).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
import workOrderRoutes from '@/routes/workOrders.route'
import analyticsRoutes from '@/routes/analytics.route'
import deviceRoutes from '@/routes/devices.route'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { CameraNode } from '@/models/device.model'
import { House } from '@/models/houseZone.model'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { User } from '@/models/user.model'
import { createProvisionedDevice } from '@/services/provisionedDevice.service'
import type { Role } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
  emitHouseDeviceStatusChange: jest.fn(), emitHouseAlertNew: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use('/devices', deviceRoutes)
app.use('/alerts', alertRoutes)
app.use('/analytics', analyticsRoutes)
app.use('/work-orders', workOrderRoutes)
app.use(errorHandler)

useTestDb()
afterEach(async () => {
  await Promise.all([ProvisionedDevice.deleteMany({}), CameraNode.deleteMany({})])
})

let seq = 0
async function tokenOf(role: Role) {
  seq++
  const user = await User.create({ email: `${role.toLowerCase()}${seq}@test.vn`, password_hash: 'password123', full_name: role, role })
  return { user, token: jwt.sign({ sub: String(user._id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' }) }
}

type Method = 'get' | 'post' | 'put' | 'delete'
const call = (method: Method, path: string, token: string, body: object = {}) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

describe('Report 3 §2.4 — route từ chối role không có quyền (403)', () => {
  it('mỗi dòng của bảng quyền trả 403 cho role bị bỏ', async () => {
    const { farm, zone, node } = await seedOwnerFarm()
    const house = (await House.findOne({ farm_id: farm._id }))!
    const camera = await CameraNode.create({ device_id: 'CAM-1', house_id: house._id, status: 'ONLINE' })
    const alert = await Alert.create({
      farm_id: farm._id, zone_id: zone._id, type: 'THRESHOLD_BREACH', severity: 'MEDIUM', title: 't', message: 'm', status: 'ACTIVE',
    })
    // Farm Technician được giao chính nhà này: các dòng dưới vẫn phải 403 vì role, không vì phạm vi
    const techUser = await tokenOf('FARM_TECHNICIAN')
    farm.members.push({ user_id: techUser.user._id, role: 'FARM_TECHNICIAN' } as never)
    await farm.save()
    house.technicians = [{ user_id: techUser.user._id, primary: true }] as never
    await house.save()
    const tech = { role: 'FARM_TECHNICIAN', token: techUser.token }
    const admin = { role: 'ADMIN', token: (await tokenOf('ADMIN')).token }
    const n = `/devices/sensor-nodes/${node._id}`
    const track = `${n}/audio-tracks/${node._id}`

    const cases: Array<[Method, string, Array<typeof tech>]> = [
      ['post',   '/farms',                                    [admin]],
      ['put',    `/farms/${farm._id}`,                        [admin]],
      ['delete', `/farms/${farm._id}`,                        [admin]],
      ['post',   `/farms/${farm._id}/members`,                [admin]],
      ['delete', `/farms/${farm._id}/members/${node._id}`,    [admin]],
      ['post',   `/farms/${farm._id}/members`,                [tech]],
      ['post',   `/farms/${farm._id}/houses`,                 [tech, admin]],
      ['put',    `/farms/houses/${house._id}/technicians/${node._id}`, [tech, admin]],
      ['post',   `/farms/houses/${house._id}/zones`,          [tech, admin]],
      ['put',    `/farms/zones/${zone._id}/thresholds`,       [tech, admin]],
      ['put',    `/farms/zones/${zone._id}/thresholds/reset`, [tech, admin]],
      ['put',    `/farms/zones/${zone._id}/fuzzy-tuning`,     [tech, admin]],
      ['put',    `${n}/thresholds`,                           [tech, admin]],
      ['post',   `${n}/relay`,                                [admin]],
      ['delete', `${n}/relay-override`,                       [admin]],
      ['put',    `${n}/speaker-schedule`,                     [tech, admin]],
      ['get',    `${n}/relay-overrides`,                      [admin]],
      ['post',   '/devices/sensor-nodes/register',            [tech, admin]],
      ['post',   '/devices/camera-nodes/register',            [tech, admin]],
      ['put',    `${n}/reassign-zone`,                        [tech, admin]],
      ['post',   `${n}/decommission`,                         [tech, admin]],
      ['post',   `${n}/restore`,                              [tech, admin]],
      ['post',   `${n}/replace`,                              [tech, admin]],
      ['post',   `/devices/camera-nodes/${camera._id}/decommission`, [tech, admin]],
      ['post',   `/devices/camera-nodes/${camera._id}/restore`,      [tech, admin]],
      ['post',   `${n}/audio-tracks`,                         [tech, admin]],
      ['put',    `${track}/sync-status`,                      [tech, admin]],
      ['delete', track,                                       [tech, admin]],
      ['get',    `/analytics/control/suggestion?zoneId=${zone._id}`, [tech, admin]],
      // ALERT-FR-009 — thợ được giao nhà xác nhận được (G-21); Administrator chỉ xem
      ['put',    `/alerts/${alert._id}/acknowledge`,          [admin]],
      ['post',   `/alerts/${alert._id}/onsite-check`,         [admin]],
      // OPS-FR-001, 004, 009 — chỉ Farm Owner mở, duyệt, mở lại, huỷ, giao lại; thợ thực hiện; Administrator không thấy
      ['get',    '/work-orders',                              [admin]],
      ['post',   '/work-orders',                              [tech, admin]],
      ['get',    `/work-orders/metrics?farmId=${farm._id}`,   [tech, admin]],
      // ANALYTICS-FR-015, 016 — tổng quan trại và so sánh nhà: Farm Owner, chuyên gia đọc (Report 3 §2.4)
      ['get',    `/farms/${farm._id}/overview`,               [tech, admin]],
      ['get',    `/farms/${farm._id}/comparison`,             [tech, admin]],
      // ANALYTICS-FR-017 — điện năng là phân tích: Administrator không xem dữ liệu vận hành (FARM-FR-009)
      ['get',    `/analytics/energy?houseId=${zone.house_id}`, [admin]],
      ['post',   `/work-orders/${node._id}/start`,            [admin]],
      ['post',   `/work-orders/${node._id}/approve`,          [tech, admin]],
      ['post',   `/work-orders/${node._id}/reopen`,           [tech, admin]],
      ['post',   `/work-orders/${node._id}/cancel`,           [tech, admin]],
      ['post',   `/work-orders/${node._id}/reassign`,         [tech, admin]],
    ]
    const allowed: string[] = []
    for (const [method, path, roles] of cases) {
      for (const { role, token } of roles) {
        const { status } = await call(method, path, token)
        if (status !== 403) allowed.push(`${role} ${method.toUpperCase()} ${path} → ${status}`)
      }
    }
    expect(allowed).toEqual([])
  })

  it('Farm Owner chỉ khởi động lại, không đẩy cấu hình hay OTA (FARM-FR-013 — lệnh khác là của Administrator)', async () => {
    const { node, token } = await seedOwnerFarm()
    await call('post', `/devices/sensor-nodes/${node._id}/commands`, token, { command: 'PUSH_CONFIG' }).expect(403)
  })
})

describe('Report 3 §2.4 — role được giữ quyền', () => {
  it('Domain Expert của farm đọc được lịch sử can thiệp tay', async () => {
    const { farm, node } = await seedOwnerFarm()
    const expert = await tokenOf('DOMAIN_EXPERT')
    farm.members.push({ user_id: expert.user._id, role: 'DOMAIN_EXPERT' } as never)
    await farm.save()
    await call('get', `/devices/sensor-nodes/${node._id}/relay-overrides`, expert.token).expect(200)
  })

  it('Farm Owner đăng ký thiết bị vào Zone của mình (201), không vào Zone farm khác (403)', async () => {
    const mine = await seedOwnerFarm()
    const other = await seedOwnerFarm()
    const { secret_key } = await createProvisionedDevice(String(mine.owner._id), { device_id: 'ESP-NEW', kind: 'SENSOR' })

    await call('post', '/devices/sensor-nodes/register', mine.token,
      { device_id: 'ESP-NEW', zone_id: String(other.zone._id), secret_key }).expect(403)
    const res = await call('post', '/devices/sensor-nodes/register', mine.token,
      { device_id: 'ESP-NEW', zone_id: String(mine.zone._id), secret_key }).expect(201)
    expect(String(res.body.data.registered_by)).toBe(String(mine.owner._id))
  })

  it('Farm Owner không dời thiết bị của mình sang Zone farm khác (403)', async () => {
    const mine = await seedOwnerFarm()
    const other = await seedOwnerFarm()
    await call('put', `${mine.relay}/reassign-zone`, mine.token, { newZoneId: String(other.zone._id) }).expect(403)
  })
})
