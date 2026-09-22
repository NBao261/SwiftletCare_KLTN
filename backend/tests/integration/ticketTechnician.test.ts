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
import { SystemSetting } from '@/models/systemSetting.model'
import { createTicket, getKpi, markResponseBreachedTickets } from '@/services/ticket.service'
import { updateTicketRouting } from '@/services/system.service'
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
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({}), SystemSetting.deleteMany({}),
  ])
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

describe('PUT /tickets/:id/scheduled-date', () => {
  const future = () => new Date(Date.now() + 2 * 86400_000).toISOString()

  it('Technician được gán dời lịch ticket lắp đặt, có ghi chú + audit', async () => {
    const { ticket, assigneeToken } = await seed({ type: 'INSTALLATION', scheduled_visit_at: new Date(Date.now() + 86400_000) })
    const at = future()
    await put(`/tickets/${ticket._id}/scheduled-date`, assigneeToken, { scheduled_visit_at: at, reason: 'Kẹt lịch' }).expect(200)

    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.scheduled_visit_at!.toISOString()).toBe(at)
    expect(saved.notes.at(-1)!.content).toContain('Kẹt lịch')
    expect(await AuditLog.countDocuments({ action: 'TICKET_RESCHEDULED' })).toBe(1)
  })

  it('bắt buộc lý do, ngày ở tương lai, đúng loại ticket và đúng người', async () => {
    const { ticket, assigneeToken, colleagueToken, farm, assignee } = await seed({ type: 'INSTALLATION' })
    const path = `/tickets/${ticket._id}/scheduled-date`
    await put(path, assigneeToken, { scheduled_visit_at: future() }).expect(422) // thiếu lý do — validate middleware trả 422
    await put(path, assigneeToken, { scheduled_visit_at: new Date(Date.now() - 1000).toISOString(), reason: 'x' }).expect(400)
    await put(path, colleagueToken, { scheduled_visit_at: future(), reason: 'x' }).expect(403)

    const fault = await Ticket.create({ farm_id: farm._id, type: 'SENSOR_FAULT', priority: 'P2', assigned_to: assignee._id })
    await put(`/tickets/${fault._id}/scheduled-date`, assigneeToken, { scheduled_visit_at: future(), reason: 'x' }).expect(400)
  })
})

describe('POST /tickets/:id/reassign-request', () => {
  it('chuyển cho Technician khác trong vùng, ticket về NEW', async () => {
    const { ticket, assigneeToken, colleague } = await seed({ status: 'IN_PROGRESS', responded_at: new Date() })
    const res = await post(`/tickets/${ticket._id}/reassign-request`, assigneeToken, { reason: 'Đang nghỉ phép' }).expect(200)

    expect(res.body.data.assigned_to._id).toBe(String(colleague._id))
    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.status).toBe('NEW')
    expect(saved.responded_at).toBeUndefined()
    expect(await AuditLog.countDocuments({ action: 'TICKET_REASSIGN_REQUESTED' })).toBe(1)
  })

  it('không còn ai thì vào hàng đợi chung (không gán lại cho chính người xin)', async () => {
    const { ticket, assigneeToken, colleague, owner } = await seed()
    await User.updateOne({ _id: colleague._id }, { is_active: false })

    await post(`/tickets/${ticket._id}/reassign-request`, assigneeToken, { reason: 'Sai khu vực' }).expect(200)
    expect((await Ticket.findById(ticket._id))!.assigned_to).toBeUndefined()

    const adminToken = tokenFor((await User.create({
      email: 'admin@test.vn', password_hash: 'password123', full_name: 'Admin', role: 'ADMIN',
    }))._id, 'ADMIN')
    const queue = await request(app).get('/tickets?unassigned=true').set('Authorization', `Bearer ${adminToken}`).expect(200)
    expect(queue.body.data.map((t: { _id: string }) => t._id)).toEqual([String(ticket._id)])
    expect(owner).toBeDefined()
  })

  it('Technician khác không xin gán lại hộ được', async () => {
    const { ticket, colleagueToken } = await seed()
    await post(`/tickets/${ticket._id}/reassign-request`, colleagueToken, { reason: 'x' }).expect(403)
  })
})

describe('Ticket Router — ngưỡng quá tải (TICKET-FR-005)', () => {
  it('bỏ qua Technician đã đủ số ticket mở, hết người thì để trống', async () => {
    const { farm, owner, assignee, colleague } = await seed()
    await updateTicketRouting(String(owner._id), { max_open_tickets_per_technician: 1 })
    // seed() đã gán 1 ticket mở cho assignee → assignee đã đầy
    const current = { _id: String(owner._id), email: owner.email, role: 'FARM_OWNER' as const }

    const second = await createTicket(current, { farm_id: String(farm._id), type: 'OTHER' })
    expect(String(second.assigned_to)).toBe(String(colleague._id))

    const third = await createTicket(current, { farm_id: String(farm._id), type: 'OTHER' })
    expect(third.assigned_to).toBeUndefined()
    expect(assignee).toBeDefined()
  })
})
