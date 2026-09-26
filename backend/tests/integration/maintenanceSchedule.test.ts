/**
 * Bảo trì định kỳ — TICKET-FR-013. Trọng tâm: đến hạn tạo đúng 1 ticket
 * MAINTENANCE (kể cả khi 2 lượt quét chạy song song), hạn kế tiếp luôn ở tương lai.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import scheduleRoutes from '@/routes/maintenanceSchedules.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { MaintenanceSchedule } from '@/models/maintenanceSchedule.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { generateDueMaintenanceTickets } from '@/services/maintenanceSchedule.service'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/maintenance-schedules', scheduleRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer
const DAY = 86400_000

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), House.deleteMany({}), Zone.deleteMany({}),
    MaintenanceSchedule.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({}),
  ])
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function seed() {
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const tech = await User.create({
    email: 'tech@test.vn', password_hash: 'password123', full_name: 'Tech', role: 'TECHNICIAN', assigned_regions: ['HCMC'],
  })
  const outsider = await User.create({
    email: 'la@test.vn', password_hash: 'password123', full_name: 'LA', role: 'TECHNICIAN', assigned_regions: ['Long An'],
  })
  const farm = await Farm.create({ name: 'Farm', address: 'x', region: 'HCMC', owner_id: owner._id })
  const otherFarm = await Farm.create({ name: 'Other', address: 'x', region: 'HCMC', owner_id: owner._id })
  const house = await House.create({ farm_id: otherFarm._id, name: 'H' })
  const foreignZone = await Zone.create({ house_id: house._id, name: 'Z' })
  return {
    farm, tech, foreignZone,
    t: { owner: tokenFor(owner._id, 'FARM_OWNER'), tech: tokenFor(tech._id, 'TECHNICIAN'), outsider: tokenFor(outsider._id, 'TECHNICIAN') },
  }
}

const create = (token: string, body: object) =>
  request(app).post('/maintenance-schedules').set('Authorization', `Bearer ${token}`).send(body)

describe('CRUD /maintenance-schedules', () => {
  const valid = (farmId: unknown) => ({
    farm_id: String(farmId), description: 'Vệ sinh cảm biến NH3', interval_days: 30,
    next_due_at: new Date(Date.now() + DAY).toISOString(),
  })

  it('Technician trong vùng tạo được, Farm Owner chỉ xem, Technician ngoài vùng bị chặn', async () => {
    const { farm, t } = await seed()
    await create(t.tech, valid(farm._id)).expect(201)
    await create(t.owner, valid(farm._id)).expect(403)
    await create(t.outsider, valid(farm._id)).expect(403)

    const list = await request(app).get(`/maintenance-schedules?farmId=${farm._id}`).set('Authorization', `Bearer ${t.owner}`).expect(200)
    expect(list.body.data).toHaveLength(1)
    expect(await AuditLog.countDocuments({ action: 'MAINTENANCE_SCHEDULE_CREATED' })).toBe(1)
  })

  it('từ chối hạn trong quá khứ và zone thuộc farm khác', async () => {
    const { farm, t, foreignZone } = await seed()
    await create(t.tech, { ...valid(farm._id), next_due_at: new Date(Date.now() - DAY).toISOString() }).expect(400)
    await create(t.tech, { ...valid(farm._id), zone_id: String(foreignZone._id) }).expect(400)
    await create(t.tech, { ...valid(farm._id), interval_days: 0 }).expect(422)
  })

  it('tạm dừng và xoá lịch', async () => {
    const { farm, t } = await seed()
    const id = (await create(t.tech, valid(farm._id)).expect(201)).body.data._id
    const paused = await request(app).put(`/maintenance-schedules/${id}`).set('Authorization', `Bearer ${t.tech}`).send({ is_active: false }).expect(200)
    expect(paused.body.data.is_active).toBe(false)
    await request(app).delete(`/maintenance-schedules/${id}`).set('Authorization', `Bearer ${t.tech}`).expect(200)
    expect(await MaintenanceSchedule.countDocuments()).toBe(0)
  })
})

describe('generateDueMaintenanceTickets', () => {
  it('tạo 1 ticket MAINTENANCE gán Technician vùng, dời hạn sang chu kỳ tương lai', async () => {
    const { farm, tech } = await seed()
    const dueAt = new Date(Date.now() - 1000)
    const schedule = await MaintenanceSchedule.create({ farm_id: farm._id, description: 'Kiểm tra relay', interval_days: 7, next_due_at: dueAt })

    expect(await generateDueMaintenanceTickets()).toBe(1)
    const [ticket] = await Ticket.find().lean()
    expect(ticket).toMatchObject({ type: 'MAINTENANCE', status: 'NEW' })
    expect(String(ticket.assigned_to)).toBe(String(tech._id))
    // Hạn đã trôi qua → hẹn sớm nhất 1 giờ nữa, không hẹn ngược về quá khứ
    expect(ticket.scheduled_visit_at!.getTime()).toBeGreaterThan(Date.now())

    const updated = (await MaintenanceSchedule.findById(schedule._id))!
    expect(updated.next_due_at.getTime()).toBe(dueAt.getTime() + 7 * DAY)
    expect(String(updated.last_ticket_id)).toBe(String(ticket._id))
    expect(await generateDueMaintenanceTickets()).toBe(0)
  })

  it('trễ nhiều chu kỳ chỉ tạo 1 ticket; 2 lượt chạy song song không tạo trùng; lịch tạm dừng bị bỏ qua', async () => {
    const { farm } = await seed()
    await MaintenanceSchedule.create({ farm_id: farm._id, description: 'A', interval_days: 1, next_due_at: new Date(Date.now() - 5.5 * DAY) })
    await MaintenanceSchedule.create({ farm_id: farm._id, description: 'B', interval_days: 1, next_due_at: new Date(Date.now() - DAY), is_active: false })

    const results = await Promise.all([generateDueMaintenanceTickets(), generateDueMaintenanceTickets()])
    expect(results[0] + results[1]).toBe(1)
    expect(await Ticket.countDocuments()).toBe(1)

    const a = (await MaintenanceSchedule.findOne({ description: 'A' }))!
    expect(a.next_due_at.getTime()).toBeGreaterThan(Date.now())
    expect(a.next_due_at.getTime()).toBeLessThanOrEqual(Date.now() + DAY)
  })

  it('tạo ticket trước hạn (lead time) và không tạo lại ở lượt quét sau', async () => {
    const { farm } = await seed()
    const dueAt = new Date(Date.now() + 2 * DAY) // trong khoảng lead 3 ngày
    const schedule = await MaintenanceSchedule.create({ farm_id: farm._id, description: 'Thay lọc', interval_days: 30, next_due_at: dueAt })

    expect(await generateDueMaintenanceTickets()).toBe(1)
    const [ticket] = await Ticket.find().lean()
    expect(ticket.scheduled_visit_at).toEqual(dueAt) // vẫn hẹn đúng ngày đến hạn
    expect((await MaintenanceSchedule.findById(schedule._id))!.next_due_at.getTime()).toBe(dueAt.getTime() + 30 * DAY)

    expect(await generateDueMaintenanceTickets()).toBe(0)
    expect(await Ticket.countDocuments()).toBe(1)
  })

  it('farm đã xoá mềm: tự tắt lịch, không sinh ticket mồ côi', async () => {
    const { farm } = await seed()
    const schedule = await MaintenanceSchedule.create({ farm_id: farm._id, description: 'A', interval_days: 7, next_due_at: new Date(Date.now() - 1000) })
    await Farm.updateOne({ _id: farm._id }, { is_deleted: true })

    expect(await generateDueMaintenanceTickets()).toBe(0)
    expect(await Ticket.countDocuments()).toBe(0)
    expect((await MaintenanceSchedule.findById(schedule._id))!.is_active).toBe(false)
    expect(await AuditLog.countDocuments({ action: 'MAINTENANCE_SCHEDULE_DISABLED' })).toBe(1)
  })

  it('Zone của lịch đã bị xoá thì ticket hạ xuống mức farm và ghi rõ', async () => {
    const { farm, t } = await seed()
    const house = await House.create({ farm_id: farm._id, name: 'H1' })
    const zone = await Zone.create({ house_id: house._id, name: 'Tầng 1' })
    await create(t.tech, {
      farm_id: String(farm._id), zone_id: String(zone._id), description: 'Vệ sinh cảm biến',
      interval_days: 30, next_due_at: new Date(Date.now() + DAY).toISOString(),
    }).expect(201)
    await Zone.deleteOne({ _id: zone._id })

    expect(await generateDueMaintenanceTickets()).toBe(1)
    const [ticket] = await Ticket.find().lean()
    expect(ticket.zone_id).toBeUndefined()
    expect(ticket.notes[0].content).toContain('Zone trong lịch đã bị xoá')
  })
})
