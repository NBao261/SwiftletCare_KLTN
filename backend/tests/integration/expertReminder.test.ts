// mỗi việc nhắc một lần; việc đã xong hoặc farm chưa có chuyên gia → 409
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import expertActivityRoutes from '@/routes/expertActivity.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { HarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthReport } from '@/models/houseHealthReport.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification } from '@/models/notification.model'
import { User } from '@/models/user.model'
import type { Role } from '@/types'

jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/expert-activity', expertActivityRoutes)
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
  await Promise.all([Alert, AuditLog, Farm, HarvestCycle, HouseHealthReport, House, Zone, Notification, User]
    .map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
async function seed({ withExpert = true } = {}) {
  seq++
  const owner = await User.create({ email: `o${seq}@rm.vn`, password_hash: 'password123', full_name: 'Chủ', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@rm.vn`, password_hash: 'password123', full_name: 'Chuyên gia', role: 'DOMAIN_EXPERT' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : [])],
  })
  const house = await House.create({ farm_id: farm._id, name: 'Nhà A' })
  const zone = await Zone.create({ house_id: house._id, farm_id: farm._id, name: 'Tầng 1' })
  const alert = await Alert.create({ farm_id: farm._id, house_id: house._id, zone_id: zone._id, type: 'NOISE_ANOMALY', severity: 'MEDIUM', title: 'Ồn', message: 'm' })
  const measured = await Alert.create({ farm_id: farm._id, zone_id: zone._id, type: 'THRESHOLD_BREACH', severity: 'MEDIUM', title: 'Ẩm', message: 'm' })
  const report = await HouseHealthReport.create({
    house_id: house._id, farm_id: farm._id, kind: 'WEEKLY', period_start: '2026-11-09', period_end: '2026-11-15',
    generated_at: new Date(), house_metrics: {}, zone_sections: [],
  })
  const cycle = await HarvestCycle.create({ farm_id: farm._id, house_id: house._id, zone_id: zone._id, start_date: new Date('2026-08-01'), status: 'CLOSED' })
  const remind = (kind: string, id: unknown, role: Role = 'FARM_OWNER', userId: unknown = owner._id) =>
    request(app).post('/expert-activity/reminders').set('Authorization', `Bearer ${tokenFor(userId, role)}`).send({ kind, id: String(id) })
  return { owner, expert, farm, house, zone, alert, measured, report, cycle, remind }
}

describe('POST /expert-activity/reminders', () => {
  it('nhắc cảnh báo, báo cáo, mùa vụ: mỗi việc một thông báo cho chuyên gia; nhắc lần hai → 409', async () => {
    const { expert, alert, report, cycle, remind } = await seed()
    for (const [kind, id] of [['alert', alert._id], ['health_report', report._id], ['harvest_cycle', cycle._id]] as const) {
      const res = await remind(kind, id)
      expect(res.status).toBe(201)
      expect(res.body.data).toMatchObject({ kind, id: String(id) })
      await remind(kind, id).expect(409)
    }
    const notices = await Notification.find({ user_id: expert._id }).lean()
    expect(notices.map(n => n.ref!.kind).sort()).toEqual(['alert', 'harvest_cycle', 'health_report'])
    expect(notices[0].title).toMatch(/^Nhắc việc: Chủ nhờ/)
    expect((await Alert.findById(alert._id).lean())!.expert_reminded_at).toBeInstanceOf(Date)
    expect(await AuditLog.countDocuments({ action: 'EXPERT_REMINDED' })).toBe(3)
  })

  it('việc đã xong hoặc không cần chuyên gia: cảnh báo đo trực tiếp 400, đã có kết luận 409, chu kỳ còn mở 409', async () => {
    const { expert, farm, house, zone, measured, report, remind } = await seed()
    await remind('alert', measured._id).expect(400)
    await HouseHealthReport.updateOne({ _id: report._id }, { expert_conclusion: { text: 'Ổn', by: expert._id, at: new Date() } })
    await remind('health_report', report._id).expect(409)
    const open = await HarvestCycle.create({ farm_id: farm._id, house_id: house._id, zone_id: zone._id, start_date: new Date(), status: 'OPEN' })
    await remind('harvest_cycle', open._id).expect(409)
  })

  it('farm chưa có chuyên gia → 409; chuyên gia, Farm Owner farm khác → 403', async () => {
    const alone = await seed({ withExpert: false })
    await alone.remind('alert', alone.alert._id).expect(409)
    const { alert, expert, remind } = await seed()
    await remind('alert', alert._id, 'DOMAIN_EXPERT', expert._id).expect(403)
    await remind('alert', alert._id, 'FARM_OWNER', alone.owner._id).expect(403)
    // Chủ farm khác gửi id cảnh báo đo trực tiếp hay chu kỳ còn mở: 403, không lộ loại cảnh báo hay trạng thái mùa vụ
    const other = await seed()
    await remind('alert', other.measured._id, 'FARM_OWNER', alone.owner._id).expect(403)
    expect(await Notification.countDocuments()).toBe(0)
  })
})
