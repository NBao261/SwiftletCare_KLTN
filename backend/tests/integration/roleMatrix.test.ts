/**
 * Report 3 §2.4 — ma trận quyền: Technician, Admin không sửa ngưỡng/hệ số mờ, không bật relay,
 * không sửa lịch loa, không xác nhận cảnh báo; Admin không quản lý farm; Farm Owner tự setup
 * thiết bị (MF-10) nhưng chỉ ở farm của mình (FARM-FR-007).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import alertRoutes from '@/routes/alerts.route'
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

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
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
    const tech = { role: 'TECHNICIAN', token: (await tokenOf('TECHNICIAN')).token }
    const admin = { role: 'ADMIN', token: (await tokenOf('ADMIN')).token }
    const n = `/devices/sensor-nodes/${node._id}`
    const track = `${n}/audio-tracks/${node._id}`

    const cases: Array<[Method, string, Array<typeof tech>]> = [
      ['post',   '/farms',                                    [admin]],
      ['put',    `/farms/${farm._id}`,                        [admin]],
      ['delete', `/farms/${farm._id}`,                        [admin]],
      ['post',   `/farms/${farm._id}/members`,                [admin]],
      ['delete', `/farms/${farm._id}/members/${node._id}`,    [admin]],
      ['post',   `/farms/${farm._id}/houses`,                 [tech, admin]],
      ['post',   `/farms/houses/${house._id}/zones`,          [tech, admin]],
      ['put',    `/farms/zones/${zone._id}/thresholds`,       [tech, admin]],
      ['put',    `/farms/zones/${zone._id}/thresholds/reset`, [tech, admin]],
      ['put',    `/farms/zones/${zone._id}/fuzzy-tuning`,     [tech, admin]],
      ['put',    `${n}/thresholds`,                           [tech, admin]],
      ['post',   `${n}/relay`,                                [tech, admin]],
      ['delete', `${n}/relay-override`,                       [tech, admin]],
      ['put',    `${n}/speaker-schedule`,                     [tech, admin]],
      ['get',    `${n}/relay-overrides`,                      [tech, admin]],
      ['post',   '/devices/sensor-nodes/register',            [admin]],
      ['post',   '/devices/camera-nodes/register',            [admin]],
      ['put',    `${n}/reassign-zone`,                        [admin]],
      ['post',   `${n}/decommission`,                         [admin]],
      ['post',   `${n}/restore`,                              [admin]],
      ['post',   `${n}/replace`,                              [admin]],
      ['post',   `/devices/camera-nodes/${camera._id}/decommission`, [admin]],
      ['post',   `/devices/camera-nodes/${camera._id}/restore`,      [admin]],
      ['post',   `${n}/commands`,                             [admin]],
      ['post',   `${n}/audio-tracks`,                         [admin]],
      ['put',    `${track}/sync-status`,                      [admin]],
      ['delete', track,                                       [admin]],
      ['put',    `/alerts/${alert._id}/acknowledge`,          [tech, admin]],
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

  it('Farm Owner không còn gửi lệnh từ xa (FARM-FR-013 chỉ Technician)', async () => {
    const { node, token } = await seedOwnerFarm()
    await call('post', `/devices/sensor-nodes/${node._id}/commands`, token, { command: 'RESTART' }).expect(403)
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
