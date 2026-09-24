/**
 * PUT /tickets/:id/admin-override — kiểm tra khu vực Technician và cờ `force` (TICKET-FR-005b).
 * Trọng tâm: `force` dạng chuỗi ("false", "0") không được bỏ qua kiểm tra khu vực.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import ticketRoutes from '@/routes/tickets.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { adminOverrideTicket } from '@/services/ticket.service'
import { notifyUser } from '@/services/notification.service'
import type { Role } from '@/types'
import { vnAt } from '../helpers/visitTime'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

const app = express()
app.use(express.json())
app.use('/tickets', ticketRoutes)
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
  await Promise.all([AuditLog.deleteMany({}), Farm.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({})])
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function seed() {
  const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'Admin', role: 'ADMIN' })
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', region: 'HCMC', owner_id: owner._id })
  const inRegion = await User.create({
    email: 'in@test.vn', password_hash: 'password123', full_name: 'In', role: 'TECHNICIAN', assigned_regions: ['HCMC'],
  })
  const outOfRegion = await User.create({
    email: 'out@test.vn', password_hash: 'password123', full_name: 'Out', role: 'TECHNICIAN', assigned_regions: ['Long An'],
  })
  const ticket = await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3' })
  return { admin, owner, token: tokenFor(admin._id, 'ADMIN'), ticket, inRegion, outOfRegion }
}

const override = (token: string, ticketId: unknown, body: object) =>
  request(app).put(`/tickets/${ticketId}/admin-override`).set('Authorization', `Bearer ${token}`).send(body)

const assignee = async (ticketId: unknown) => (await Ticket.findById(ticketId))!.assigned_to

describe('admin override — technician region check', () => {
  it('assigns a technician who covers the farm region without needing force', async () => {
    const { token, ticket, inRegion } = await seed()

    await override(token, ticket._id, { assigned_to: String(inRegion._id), reason: 'Điều phối lại' }).expect(200)

    expect(String(await assignee(ticket._id))).toBe(String(inRegion._id))
    const [audit] = await AuditLog.find({ action: 'TICKET_ADMIN_OVERRIDE' }).lean()
    expect(audit.metadata).not.toHaveProperty('forcedOutOfRegion')
  })

  it('refuses a technician outside the region when force is missing (400) and changes nothing', async () => {
    const { token, ticket, outOfRegion } = await seed()

    const res = await override(token, ticket._id, { assigned_to: String(outOfRegion._id), reason: 'x' }).expect(400)

    expect(res.body.error.message).toContain('force=true')
    expect(await assignee(ticket._id)).toBeUndefined()
  })

  it.each([false, 'false', '0', 0, ''])('does not treat force=%p as true', async force => {
    const { token, ticket, outOfRegion } = await seed()

    // "false"/"0" trước đây lọt xuống service dạng chuỗi truthy và bỏ qua kiểm tra khu vực; nay được ép về false
    // (400 vì không khớp khu vực). Chuỗi rỗng không phải boolean hợp lệ nên bị chặn sớm hơn (422).
    await override(token, ticket._id, { assigned_to: String(outOfRegion._id), reason: 'x', force }).expect(
      force === '' ? 422 : 400,
    )

    expect(await assignee(ticket._id)).toBeUndefined()
  })

  it.each([true, 'true', '1'])('lets force=%p assign an out-of-region technician and records it in the audit log', async force => {
    const { token, ticket, outOfRegion } = await seed()

    await override(token, ticket._id, { assigned_to: String(outOfRegion._id), reason: 'Khẩn cấp', force }).expect(200)

    expect(String(await assignee(ticket._id))).toBe(String(outOfRegion._id))
    const [audit] = await AuditLog.find({ action: 'TICKET_ADMIN_OVERRIDE' }).lean()
    expect(audit.metadata).toMatchObject({ forcedOutOfRegion: true })
  })

  it('rejects a force value that is not a boolean (422)', async () => {
    const { token, ticket, outOfRegion } = await seed()
    await override(token, ticket._id, { assigned_to: String(outOfRegion._id), reason: 'x', force: 'yes-please' }).expect(422)
  })

  it('refuses a farm with no region for every technician unless forced', async () => {
    const { token, ticket, inRegion } = await seed()
    await Farm.updateOne({ _id: ticket.farm_id }, { $unset: { region: 1 } })

    await override(token, ticket._id, { assigned_to: String(inRegion._id), reason: 'x' }).expect(400)
    await override(token, ticket._id, { assigned_to: String(inRegion._id), reason: 'x', force: true }).expect(200)
  })
})

describe('adminOverrideTicket called directly (not through the route)', () => {
  it('only an exact boolean true bypasses the region check — a truthy string does not', async () => {
    const { admin, ticket, outOfRegion } = await seed()
    const actor = { _id: String(admin._id), role: 'ADMIN' } as never

    await expect(adminOverrideTicket(String(ticket._id), actor, {
      assigned_to: String(outOfRegion._id), reason: 'x', force: 'false' as never,
    })).rejects.toMatchObject({ statusCode: 400 })

    await expect(adminOverrideTicket(String(ticket._id), actor, {
      assigned_to: String(outOfRegion._id), reason: 'x', force: true,
    })).resolves.toBeDefined()
  })

  it('gán Technician mới thì ticket quay về NEW để người mới xác nhận tiếp nhận', async () => {
    const { token, ticket, inRegion } = await seed()
    await Ticket.updateOne({ _id: ticket._id }, { status: 'IN_PROGRESS', responded_at: new Date() })

    await override(token, ticket._id, { assigned_to: String(inRegion._id), reason: 'Điều phối lại' }).expect(200)
    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.status).toBe('NEW')
    expect(saved.responded_at).toBeUndefined()
    expect(saved.assigned_at).toBeInstanceOf(Date)
  })

  it('Admin ép luôn trạng thái thì giữ nguyên trạng thái Admin chọn', async () => {
    const { token, ticket, inRegion } = await seed()
    await override(token, ticket._id, {
      assigned_to: String(inRegion._id), status: 'IN_PROGRESS', reason: 'Đang xử lý tiếp',
    }).expect(200)
    expect((await Ticket.findById(ticket._id))!.status).toBe('IN_PROGRESS')
  })

  it('không mở lại ticket đã đóng khi gán lại mà không nêu status', async () => {
    const { token, ticket, inRegion } = await seed()
    await Ticket.updateOne({ _id: ticket._id }, { status: 'CLOSED', closed_at: new Date() })

    const res = await override(token, ticket._id, { assigned_to: String(inRegion._id), reason: 'Điều phối lại' }).expect(409)
    expect(res.body.error.message).toContain('đã đóng')
    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.status).toBe('CLOSED')
    expect(saved.closed_at).toBeInstanceOf(Date)

    // Admin nói rõ ý định mở lại thì vẫn làm được
    await override(token, ticket._id, {
      assigned_to: String(inRegion._id), status: 'IN_PROGRESS', reason: 'Khách báo lỗi lại',
    }).expect(200)
  })

  it('gán lại đúng người đang phụ trách thì không dời mốc giao việc', async () => {
    const { token, ticket, inRegion } = await seed()
    const assignedAt = new Date(Date.now() - 3600_000)
    await Ticket.updateOne({ _id: ticket._id }, {
      assigned_to: inRegion._id, assigned_at: assignedAt, responded_at: new Date(Date.now() - 1800_000), status: 'IN_PROGRESS',
    })

    await override(token, ticket._id, { assigned_to: String(inRegion._id), reason: 'Xác nhận lại' }).expect(200)
    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.assigned_at!.getTime()).toBe(assignedAt.getTime()) // responded_at cũ vẫn sau mốc giao → KPI không ra số âm
    expect(saved.status).toBe('IN_PROGRESS')
  })
})

describe('admin override — lịch hẹn (TICKET-FR-005b)', () => {
  it('đổi giờ hẹn theo cùng khung 7:00–18:00, báo Farm Owner và Technician đang giữ', async () => {
    const { token, ticket, owner, inRegion } = await seed()
    await Ticket.updateOne({ _id: ticket._id }, { type: 'INSTALLATION', assigned_to: inRegion._id })

    await override(token, ticket._id, { scheduled_visit_at: vnAt(1, 21).toISOString(), reason: 'Farm Owner gọi điện' }).expect(400)

    ;(notifyUser as jest.Mock).mockClear()
    const at = vnAt(1, 15).toISOString()
    await override(token, ticket._id, { scheduled_visit_at: at, reason: 'Farm Owner gọi điện' }).expect(200)
    expect((await Ticket.findById(ticket._id))!.scheduled_visit_at!.toISOString()).toBe(at)
    const notified = (notifyUser as jest.Mock).mock.calls.map(c => String(c[0]))
    expect(notified).toEqual(expect.arrayContaining([String(owner._id), String(inRegion._id)]))
  })
})
