jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitNotificationNew: jest.fn(), emitRelayUpdate: jest.fn(), emitTelemetryUpdate: jest.fn(), emitAlertNew: jest.fn(),
}))

import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import adminRoutes from '@/routes/admin.route'
import analyticsRoutes from '@/routes/analytics.route'
import authRoutes from '@/routes/auth.route'
import deviceRoutes from '@/routes/devices.route'
import farmRoutes from '@/routes/farms.route'
import harvestRoutes from '@/routes/harvests.route'
import healthReportRoutes from '@/routes/healthReports.route'
import invitationRoutes from '@/routes/invitations.route'
import notificationRoutes from '@/routes/notifications.route'
import systemRoutes from '@/routes/system.route'
import telemetryRoutes from '@/routes/telemetry.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { publishDeviceCommand } from '@/mqtt/mqtt.client'
import { User } from '@/models/user.model'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/admin', adminRoutes)
app.use('/analytics', analyticsRoutes)
app.use('/auth', authRoutes)
app.use('/devices', deviceRoutes)
app.use('/farms', farmRoutes)
app.use('/harvests', harvestRoutes)
app.use('/health-reports', healthReportRoutes)
app.use('/invitations', invitationRoutes)
app.use('/notifications', notificationRoutes)
app.use('/system', systemRoutes)
app.use('/telemetry', telemetryRoutes)
app.use(errorHandler)

useTestDb()

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const long = (n: number) => 'a'.repeat(n)
const ID = '507f1f77bcf86cd799439011'

// Mảng và object lọt qua notEmpty/isEmail/isLength nếu không có isString: trước đây thành lỗi 500
describe('đăng nhập và mật khẩu: sai kiểu → 422, không 500', () => {
  it.each([
    ['email là mảng', { email: ['a@b.vn'], password: 'password123' }],
    ['mật khẩu là object', { email: 'a@b.vn', password: { a: 1 } }],
    ['mật khẩu quá dài', { email: 'a@b.vn', password: long(129) }],
  ])('POST /auth/login: %s', async (_label, body) => {
    await request(app).post('/auth/login').send(body).expect(422)
  })

  it.each([
    ['mã không phải 6 số', { email: 'a@b.vn', token: 'abc', newPassword: 'password123' }],
    ['mã là object', { email: 'a@b.vn', token: { $ne: 1 }, newPassword: 'password123' }],
    ['mật khẩu mới dài hơn 72', { email: 'a@b.vn', token: '123456', newPassword: long(73) }],
  ])('POST /auth/reset-password: %s', async (_label, body) => {
    await request(app).post('/auth/reset-password').send(body).expect(422)
  })

  it('đổi mật khẩu: mật khẩu mới dài hơn 72 → 422', async () => {
    const { token } = await seedOwnerFarm()
    await request(app).put('/auth/password').set(bearer(token)).send({ current_password: 'password123', new_password: long(73) }).expect(422)
  })

  it('đăng xuất với refreshToken là object → 200, không 500', async () => {
    const { token } = await seedOwnerFarm()
    await request(app).post('/auth/logout').set(bearer(token)).send({ refreshToken: { a: 1 } }).expect(200)
  })

  it('tạo tài khoản từ lời mời: mật khẩu dài hơn 72 → 422', async () => {
    await request(app).post('/invitations/sometoken/create-account').send({ full_name: 'An', password: long(73) }).expect(422)
  })
})

describe('trang trại, nhà yến', () => {
  it.each([
    ['địa chỉ là mảng', { address: ['x'] }],
    ['địa chỉ quá dài', { address: long(201) }],
    ['tên là mảng', { name: ['x'] }],
  ])('POST /farms: %s → 422', async (_label, override) => {
    const { token } = await seedOwnerFarm()
    await request(app).post('/farms').set(bearer(token))
      .send({ name: 'Trại', address: 'Số 1', coordinates: { lat: 10, lng: 106 }, ...override }).expect(422)
  })

  it.each([
    ['rỗng', ''],
    ['mảng', []],
    ['quá dài', long(201)],
  ])('PUT /farms/:id: địa chỉ %s → 422', async (_label, address) => {
    const { token, farm } = await seedOwnerFarm()
    await request(app).put(`/farms/${farm._id}`).set(bearer(token)).send({ address }).expect(422)
  })

  it.each([
    ['object', { a: 1 }],
    ['quá dài', long(501)],
  ])('POST /farms/:id/houses: mô tả %s → 422', async (_label, description) => {
    const { token, farm } = await seedOwnerFarm()
    await request(app).post(`/farms/${farm._id}/houses`).set(bearer(token)).send({ name: 'Nhà 2', description }).expect(422)
  })

  it('mời thành viên: email là mảng → 422', async () => {
    const { token, farm } = await seedOwnerFarm()
    await request(app).post(`/farms/${farm._id}/members`).set(bearer(token)).send({ email: ['a@b.vn'] }).expect(422)
  })
})

describe('thiết bị', () => {
  it('relay: state "false" (chuỗi) được đổi thành false trước khi gửi cho thiết bị', async () => {
    const { token, relay } = await seedOwnerFarm()
    await request(app).post(`${relay}/relay`).set(bearer(token)).send({ relayName: 'misting', state: 'false' }).expect(200)
    expect(publishDeviceCommand).toHaveBeenCalledWith(expect.any(String), 'RELAY', expect.objectContaining({ state: false }))
  })

  it('relay: tên relay lạ → 422', async () => {
    const { token, relay } = await seedOwnerFarm()
    await request(app).post(`${relay}/relay`).set(bearer(token)).send({ relayName: 'heating', state: true }).expect(422)
  })

  it.each([
    ['mã thiết bị là mảng', { device_id: ['n1'], secret_key: 'k' }],
    ['mã thiết bị có ký tự lạ', { device_id: 'bad id!', secret_key: 'k' }],
    ['mã thiết bị dài hơn 40', { device_id: long(41), secret_key: 'k' }],
    ['mã kích hoạt dài hơn 128', { device_id: 'node_1', secret_key: long(129) }],
  ])('đăng ký bộ điều khiển: %s → 422', async (_label, body) => {
    const { token, zone } = await seedOwnerFarm()
    await request(app).post('/devices/sensor-nodes/register').set(bearer(token)).send({ zone_id: String(zone._id), ...body }).expect(422)
  })

  it.each([
    ['mảng', ['x']],
    ['quá dài', long(501)],
  ])('gỡ bộ điều khiển: lý do %s → 422', async (_label, reason) => {
    const { token, node } = await seedOwnerFarm()
    await request(app).post(`/devices/sensor-nodes/${node._id}/decommission`).set(bearer(token)).send({ reason }).expect(422)
  })

  it('lịch loa: số bài vượt 255 → 422', async () => {
    const { token, relay } = await seedOwnerFarm()
    await request(app).put(`${relay}/speaker-schedule`).set(bearer(token)).send({ track: 256 }).expect(422)
  })
})

describe('thu hoạch', () => {
  const valid = (zoneId: unknown) => ({
    zone_id: String(zoneId), harvest_date: new Date().toISOString(), nest_count: 40, weight_grams: 320.5, nest_type: 'RAW',
  })

  it.each([
    ['link javascript:', { product_images: ['javascript:alert(1)'] }],
    ['link không phải http(s)', { product_images: ['ftp://x.vn/a.jpg'] }],
    ['hơn 5 link', { product_images: Array.from({ length: 6 }, (_, i) => `https://x.vn/${i}.jpg`) }],
    ['số tổ vượt giới hạn', { nest_count: 100_001 }],
    ['khối lượng vượt giới hạn', { weight_grams: 1_000_001 }],
  ])('%s → 422', async (_label, override) => {
    const { zone, token } = await seedOwnerFarm()
    await request(app).post('/harvests').set(bearer(token)).send({ ...valid(zone._id), ...override }).expect(422)
  })

  it('link https hợp lệ → 201', async () => {
    const { zone, token } = await seedOwnerFarm()
    await request(app).post('/harvests').set(bearer(token)).send({ ...valid(zone._id), product_images: ['https://x.vn/a.jpg'] }).expect(201)
  })

  it('lọc theo farmId là mảng → 422', async () => {
    const { token } = await seedOwnerFarm()
    await request(app).get('/harvests?farmId[]=a&farmId[]=b').set(bearer(token)).expect(422)
  })
})

describe('khoảng thời gian, phân trang, danh sách ID', () => {
  it.each([
    ['tuần ISO không đọc được', 'from=2026-W43'],
    ['from sau to', 'from=2026-02-02&to=2026-01-01'],
  ])('lịch sử telemetry: %s → 422', async (_label, qs) => {
    const { token, zone } = await seedOwnerFarm()
    await request(app).get(`/telemetry/zones/${zone._id}/history?${qs}`).set(bearer(token)).expect(422)
  })

  it('lịch sử telemetry: khoảng hợp lệ → 200', async () => {
    const { token, zone } = await seedOwnerFarm()
    await request(app).get(`/telemetry/zones/${zone._id}/history?from=2026-01-01&to=2026-02-01`).set(bearer(token)).expect(200)
  })

  it.each([
    ['không phải ID', 'zoneIds=abc'],
    ['ID có ký tự ngoài hệ 16', `zoneIds=${'g'.repeat(24)}`],
    ['hơn 6 ID', `zoneIds=${Array.from({ length: 7 }, (_, i) => ID.slice(0, 23) + i).join(',')}`],
  ])('so sánh zone: %s → 422', async (_label, qs) => {
    const { token } = await seedOwnerFarm()
    await request(app).get(`/analytics/env/compare?${qs}`).set(bearer(token)).expect(422)
  })

  it('so sánh zone: ID thật của Zone → 200, và đủ 6 ID vẫn qua kiểm tra', async () => {
    const { token, zone } = await seedOwnerFarm()
    await request(app).get(`/analytics/env/compare?zoneIds=${zone._id}`).set(bearer(token)).expect(200)
    // 6 ID đúng dạng: qua validator, Zone lạ trả 404 từ service chứ không phải 422
    const six = Array.from({ length: 6 }, (_, i) => ID.slice(0, 23) + i).join(',')
    const res = await request(app).get(`/analytics/env/compare?zoneIds=${six}`).set(bearer(token))
    expect(res.status).not.toBe(422)
  })

  it('mã FCM quá dài → 422', async () => {
    const { token } = await seedOwnerFarm()
    await request(app).post('/notifications/push-tokens').set(bearer(token)).send({ token: long(513), platform: 'android' }).expect(422)
  })
})

describe('Administrator tạo Farm Owner', () => {
  const adminToken = async () => {
    const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'A', role: 'ADMIN' })
    return jwt.sign({ sub: String(admin._id), role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  }

  it.each([
    ['email là mảng', { email: ['a@b.vn'] }],
    ['họ tên dài hơn 100', { full_name: long(101) }],
    ['số điện thoại có chữ', { phone: 'abc' }],
  ])('%s → 422', async (_label, override) => {
    const token = await adminToken()
    await request(app).post('/admin/farm-owners').set(bearer(token))
      .send({ email: 'owner@test.vn', full_name: 'Chủ nhà', ...override }).expect(422)
  })

  it('số điện thoại để trống vẫn tạo được → 201', async () => {
    const token = await adminToken()
    await request(app).post('/admin/farm-owners').set(bearer(token))
      .send({ email: 'owner@test.vn', full_name: 'Chủ nhà', phone: '' }).expect(201)
  })

  it('lý do từ chối yêu cầu xoá quá dài → 422', async () => {
    const token = await adminToken()
    await request(app).put(`/admin/delete-requests/${ID}/reject`).set(bearer(token)).send({ reason: long(501) }).expect(422)
  })
})

// Tham số lặp (?x=a&x=b) thành mảng: isMongoId/isIn kiểm từng phần tử nên vẫn qua nếu thiếu isString
describe('bộ lọc query lặp lại hoặc là object → 422', () => {
  const twice = (name: string, value: string) => `${name}=${value}&${name}=${value}`

  it.each([
    ['/health-reports/days', `${twice('houseId', ID)}`],
    ['/health-reports/days', `farmId=${ID}&${twice('from', '2026-11-01')}`],
    ['/health-reports/days', `farmId=${ID}&${twice('myRatingState', 'PENDING')}`],
    ['/health-reports/days.csv', `farmId=${ID}&${twice('lang', 'vi')}`],
    ['/health-reports', `${twice('farmId', ID)}`],
    ['/health-reports', `farmId=${ID}&${twice('kind', 'DAILY')}`],
    ['/health-reports', `farmId=${ID}&${twice('hasConclusion', 'true')}`],
    ['/analytics/env/summary', `${twice('zoneId', ID)}`],
    ['/analytics/correlation', `zoneId[$ne]=${ID}`],
  ])('Farm Owner GET %s?%s', async (path, query) => {
    const { token } = await seedOwnerFarm()
    await request(app).get(`${path}?${query}`).set(bearer(token)).expect(422)
  })

  it.each([
    ['/system/audit-logs', `${twice('actorId', ID)}`],
    ['/system/audit-logs', `targetId[$ne]=${ID}`],
    ['/admin/users', `${twice('role', 'FARM_OWNER')}`],
    ['/admin/users', `${twice('status', 'active')}`],
    ['/admin/provisioned-devices', `${twice('kind', 'SENSOR')}`],
    ['/admin/provisioned-devices', `${twice('claimed', 'true')}`],
  ])('Administrator GET %s?%s', async (path, query) => {
    const admin = await User.create({ email: `admin-q-${Date.now()}@test.vn`, password_hash: 'password123', full_name: 'A', role: 'ADMIN' })
    const token = jwt.sign({ sub: String(admin._id), role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
    await request(app).get(`${path}?${query}`).set(bearer(token)).expect(422)
  })

  it('page, limit lặp lại → 422 (danh sách lời mời, chu kỳ thu hoạch, người dùng của Admin)', async () => {
    const { token, farm } = await seedOwnerFarm()
    await request(app).get(`/farms/${farm._id}/invitations?${twice('page', '1')}`).set(bearer(token)).expect(422)
    await request(app).get(`/harvests/cycles?${twice('limit', '5')}`).set(bearer(token)).expect(422)
    await request(app).get('/harvests?page=1&page=2').set(bearer(token)).expect(422)
    const admin = await User.create({ email: `admin-p-${Date.now()}@test.vn`, password_hash: 'password123', full_name: 'A', role: 'ADMIN' })
    const adminToken = jwt.sign({ sub: String(admin._id), role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
    await request(app).get(`/admin/users?${twice('page', '1')}`).set(bearer(adminToken)).expect(422)
    await request(app).get('/admin/users?page=1&limit=5').set(bearer(adminToken)).expect(200)
  })

  it('một giá trị thì vẫn qua kiểm tra', async () => {
    const { token, zone } = await seedOwnerFarm()
    await request(app).get(`/analytics/env/summary?zoneId=${zone._id}`).set(bearer(token)).expect(200)
  })
})
