/**
 * Thao tác xử lý ticket của Technician (TICKET-FR-004b, TICKET-FR-007, Flow 9).
 * Trọng tâm: Technician cùng vùng xem được ticket của nhau nhưng chỉ người đang
 * được gán mới được xử lý; mốc tiếp nhận (`responded_at`) đo được SLA phản hồi.
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
import { getKpi, markResponseBreachedTickets } from '@/services/ticket.service'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

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

const technician = (email: string, regions = ['HCMC']) =>
  User.create({ email, password_hash: 'password123', full_name: email, role: 'TECHNICIAN', assigned_regions: regions })

async function seed(ticketOverrides: object = {}) {
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', region: 'HCMC', owner_id: owner._id })
  const assignee = await technician('a@test.vn')
  const colleague = await technician('b@test.vn')
  const ticket = await Ticket.create({
    farm_id: farm._id, type: 'OTHER', priority: 'P3', assigned_to: assignee._id, ...ticketOverrides,
  })
  return {
    owner, farm, assignee, colleague, ticket,
    assigneeToken: tokenFor(assignee._id, 'TECHNICIAN'),
    colleagueToken: tokenFor(colleague._id, 'TECHNICIAN'),
  }
}

const put = (path: string, token: string, body: object) =>
  request(app).put(path).set('Authorization', `Bearer ${token}`).send(body)
const post = (path: string, token: string, body: object) =>
  request(app).post(path).set('Authorization', `Bearer ${token}`).send(body)

describe('chỉ Technician đang được gán mới xử lý được ticket', () => {
  it('Technician cùng vùng vẫn xem được ticket', async () => {
    const { ticket, colleagueToken } = await seed()
    await request(app).get(`/tickets/${ticket._id}`).set('Authorization', `Bearer ${colleagueToken}`).expect(200)
  })

  it('Technician khác không đổi trạng thái / SAT / escalate được', async () => {
    const { ticket, colleagueToken } = await seed()
    await put(`/tickets/${ticket._id}/status`, colleagueToken, { status: 'IN_PROGRESS' }).expect(403)
    await put(`/tickets/${ticket._id}/sat-checklist`, colleagueToken, { relay_test_ok: true }).expect(403)
    await post(`/tickets/${ticket._id}/escalate`, colleagueToken, { reason: 'x' }).expect(403)
    expect((await Ticket.findById(ticket._id))!.status).toBe('NEW')
  })

  it('người được gán thì làm được', async () => {
    const { ticket, assigneeToken } = await seed()
    await put(`/tickets/${ticket._id}/status`, assigneeToken, { status: 'IN_PROGRESS' }).expect(200)
  })
})

describe('xác nhận tiếp nhận (responded_at)', () => {
  it('ghi mốc ở lần IN_PROGRESS đầu tiên và không ghi đè ở lần sau', async () => {
    const { ticket, assigneeToken } = await seed()
    await put(`/tickets/${ticket._id}/status`, assigneeToken, { status: 'IN_PROGRESS' }).expect(200)
    const first = (await Ticket.findById(ticket._id))!.responded_at
    expect(first).toBeInstanceOf(Date)

    await put(`/tickets/${ticket._id}/status`, assigneeToken, { status: 'AWAITING_FIELD_CONFIRMATION' }).expect(200)
    await put(`/tickets/${ticket._id}/status`, assigneeToken, { status: 'IN_PROGRESS' }).expect(200)
    expect((await Ticket.findById(ticket._id))!.responded_at).toEqual(first)
  })

  it('KPI có thời gian phản hồi trung bình theo Technician', async () => {
    const { ticket, assignee } = await seed()
    // created_at bất biến qua Mongoose — ghi thẳng collection để giả lập ticket tạo 3 giờ trước
    await Ticket.collection.updateOne({ _id: ticket._id }, { $set: {
      created_at: new Date(Date.now() - 3 * 3600_000), responded_at: new Date(Date.now() - 1 * 3600_000),
    } })
    const kpi = await getKpi()
    const row = kpi.byTechnician.find(r => r.technician_id === String(assignee._id))!
    expect(row.avgResponseHours).toBeCloseTo(2, 1)
  })
})

describe('markResponseBreachedTickets', () => {
  it('đánh dấu ticket NEW quá hạn phản hồi, bỏ qua ticket đã tiếp nhận', async () => {
    const past = new Date(Date.now() - 60_000)
    const { ticket, farm } = await seed({ sla_response_due_at: past })
    const accepted = await Ticket.create({
      farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'IN_PROGRESS', responded_at: new Date(), sla_response_due_at: past,
    })

    expect(await markResponseBreachedTickets()).toBe(1)
    expect((await Ticket.findById(ticket._id))!.is_sla_response_breached).toBe(true)
    expect((await Ticket.findById(accepted._id))!.is_sla_response_breached).toBe(false)
    expect(await AuditLog.countDocuments({ action: 'TICKET_SLA_RESPONSE_BREACHED' })).toBe(1)

    // Chạy lại không đánh dấu trùng
    expect(await markResponseBreachedTickets()).toBe(0)
  })
})

describe('escalate', () => {
  it('ghi audit và không cho escalate ticket đã đóng', async () => {
    const { ticket, assigneeToken } = await seed()
    await post(`/tickets/${ticket._id}/escalate`, assigneeToken, { reason: 'Cần linh kiện' }).expect(200)
    expect(await AuditLog.countDocuments({ action: 'TICKET_ESCALATED', target_id: String(ticket._id) })).toBe(1)

    await Ticket.updateOne({ _id: ticket._id }, { status: 'CLOSED' })
    await post(`/tickets/${ticket._id}/escalate`, assigneeToken, {}).expect(409)
  })
})
