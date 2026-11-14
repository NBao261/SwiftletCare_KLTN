/**
 * OPS-FR-009, BR-40 — MTTA = trung bình (xác nhận − tạo); MTTR = trung bình (Work Order đóng, không có thì cảnh báo
 * đóng − tạo); theo nhà và theo thợ được định tuyến; cảnh báo bị bác bỏ không tính. ALERT-FR-005 — kênh theo mức
 * cảnh báo, CRITICAL phải còn kênh ngoài ứng dụng.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import authRoutes from '@/routes/auth.route'
import workOrderRoutes from '@/routes/workOrders.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { House } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { WorkOrder } from '@/models/workOrder.model'
import { channelEnabled } from '@/services/notification.service'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/socket', () => ({ emitAlertNew: jest.fn(), emitHouseAlertNew: jest.fn(), emitNotificationNew: jest.fn() }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/work-orders', workOrderRoutes)
app.use(errorHandler)

useTestDb()

const T0 = new Date('2026-11-10T00:00:00Z')
const at = (min: number) => new Date(T0.getTime() + min * 60_000)

describe('MTTA, MTTR (OPS-FR-009)', () => {
  it('đúng công thức BR-40, theo nhà và theo thợ; Farm Technician → 403; from không trước to → 400', async () => {
    const { farm, zone, token } = await seedOwnerFarm()
    const house = (await House.findOne({ farm_id: farm._id }))!
    const house2 = await House.create({ farm_id: farm._id, name: 'H2' })
    const tech = await User.create({ email: 'mt@test.vn', password_hash: 'password123', full_name: 'Thợ A', role: 'FARM_TECHNICIAN' })
    const base = { farm_id: farm._id, severity: 'HIGH', title: 't', message: 'm' }
    // Nhà H: xác nhận sau 10 và 20 phút; 1 cái đóng bằng Work Order ở phút 60, 1 cái tự đóng ở phút 30
    const a1 = await Alert.create({
      ...base, zone_id: zone._id, type: 'MISTING_INEFFECTIVE', status: 'RESOLVED', created_at: at(0),
      acknowledged_at: at(10), resolved_at: at(70), routing: { technician_id: tech._id, owners_notified: false },
    })
    await WorkOrder.create({
      farm_id: farm._id, house_id: house._id, alert_id: a1._id, origin: 'ALERT', title: 'x', status: 'CLOSED', is_open: false, closed_at: at(60),
    })
    await Alert.create({
      ...base, zone_id: zone._id, type: 'NODE_OFFLINE', status: 'RESOLVED', created_at: at(0),
      acknowledged_at: at(20), resolved_at: at(30), routing: { technician_id: tech._id, owners_notified: false },
    })
    // Nhà H2: chưa xác nhận, chưa đóng; cảnh báo bị bác bỏ không tính; cảnh báo ngoài khoảng không tính
    await Alert.create({ ...base, house_id: house2._id, type: 'EDGE_AI_DEGRADED', status: 'ACTIVE', created_at: at(5) })
    await Alert.create({ ...base, zone_id: zone._id, type: 'NOISE_ANOMALY', status: 'DISMISSED', created_at: at(5), acknowledged_at: at(100) })
    await Alert.create({ ...base, zone_id: zone._id, type: 'NODE_OFFLINE', status: 'RESOLVED', created_at: at(-60), acknowledged_at: at(-50) })

    const q = `farmId=${farm._id}&from=${at(-1).toISOString()}&to=${at(120).toISOString()}`
    const res = await request(app).get(`/work-orders/metrics?${q}`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data).toMatchObject({
      target_ack_min: 15,
      overall: { alerts: 3, mtta_min: 15, mttr_min: 45, acknowledged_within_target_pct: 50 },
      on_time_maintenance_rate: null,
    })
    expect(res.body.data.by_house).toEqual(expect.arrayContaining([
      expect.objectContaining({ house_id: String(house._id), alerts: 2, mtta_min: 15, mttr_min: 45 }),
      expect.objectContaining({ house_id: String(house2._id), alerts: 1, mtta_min: null, mttr_min: null }),
    ]))
    expect(res.body.data.by_technician).toEqual([expect.objectContaining({ technician_id: String(tech._id), full_name: 'Thợ A', alerts: 2 })])

    const one = await request(app).get(`/work-orders/metrics?${q}&houseId=${house2._id}`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(one.body.data.overall.alerts).toBe(1)

    await request(app).get(`/work-orders/metrics?farmId=${farm._id}&from=${at(10).toISOString()}&to=${at(0).toISOString()}`)
      .set('Authorization', `Bearer ${token}`).expect(400)
    const techToken = jwt.sign({ sub: String(tech._id), role: 'FARM_TECHNICIAN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
    await request(app).get(`/work-orders/metrics?${q}`).set('Authorization', `Bearer ${techToken}`).expect(403)
  })
})

describe('kênh theo mức cảnh báo (ALERT-FR-005)', () => {
  it('mức ghi đè cài đặt chung; không đặt thì theo cài đặt chung', () => {
    const prefs = { push: true, telegram: true, quiet_hours: { start: '22:00', end: '06:00' }, by_severity: { LOW: { push: false } } }
    expect(channelEnabled(prefs, 'LOW', 'push')).toBe(false)
    expect(channelEnabled(prefs, 'LOW', 'telegram')).toBe(true)
    expect(channelEnabled(prefs, 'HIGH', 'push')).toBe(true)
  })

  it('PUT /auth/notification-preferences: lưu theo mức, bỏ ghi đè bằng null, CRITICAL không còn kênh ngoài ứng dụng → 400', async () => {
    const { token } = await seedOwnerFarm()
    const put = (body: object) => request(app).put('/auth/notification-preferences').set('Authorization', `Bearer ${token}`).send(body)

    const saved = await put({ by_severity: { LOW: { push: false, telegram: false }, MEDIUM: { telegram: false } } }).expect(200)
    expect(saved.body.data.notification_preferences.by_severity).toEqual({ LOW: { push: false, telegram: false }, MEDIUM: { telegram: false } })

    await put({ by_severity: { CRITICAL: { push: false, telegram: false } } }).expect(400)
    await put({ push: false, telegram: false }).expect(400)
    // CRITICAL vẫn còn Telegram riêng thì tắt chung được
    await put({ push: false, telegram: false, by_severity: { CRITICAL: { telegram: true } } }).expect(200)
    await put({ by_severity: { CRITICAL: null } }).expect(400)

    await put({ by_severity: { LOW: 'x' } }).expect(422)
    await put({ quiet_hours: { start: '25:00' } }).expect(422)
  })
})
