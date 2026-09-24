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
import { House, Zone } from '@/models/houseZone.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { createTicket, getKpi, markResponseBreachedTickets } from '@/services/ticket.service'
import { notifyUser } from '@/services/notification.service'
import { updateTicketRouting } from '@/services/system.service'
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
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({}), SystemSetting.deleteMany({}),
    House.deleteMany({}), Zone.deleteMany({}),
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

  it('đóng thẳng ticket từ NEW (sự cố tự hết) vẫn ghi mốc phản hồi', async () => {
    const { ticket, assigneeToken } = await seed()
    await put(`/tickets/${ticket._id}/status`, assigneeToken, {
      status: 'CLOSED', note: 'Tự phục hồi, không cần sửa chữa',
    }).expect(200)
    expect((await Ticket.findById(ticket._id))!.responded_at).toBeInstanceOf(Date)
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

  it('KPI tính từ lúc được giao, không phạt người nhận ticket chuyền tay', async () => {
    const { ticket, colleague } = await seed()
    // Ticket tạo 6 giờ trước, mới chuyển cho người thứ hai 1 giờ trước, họ nhận sau 30 phút
    await Ticket.collection.updateOne({ _id: ticket._id }, { $set: {
      created_at: new Date(Date.now() - 6 * 3600_000),
      assigned_to: colleague._id,
      assigned_at: new Date(Date.now() - 3600_000),
      responded_at: new Date(Date.now() - 1800_000),
    } })
    const kpi = await getKpi()
    const row = kpi.byTechnician.find(r => r.technician_id === String(colleague._id))!
    expect(row.avgResponseHours).toBeCloseTo(0.5, 1)
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

    // Escalate là xin hỗ trợ, không phải vi phạm SLA — không được kéo KPI của Technician xuống
    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.escalated_at).toBeInstanceOf(Date)
    expect(saved.escalation_reason).toBe('Cần linh kiện')
    expect(saved.is_sla_breached).toBe(false)

    await Ticket.updateOne({ _id: ticket._id }, { status: 'CLOSED' })
    await post(`/tickets/${ticket._id}/escalate`, assigneeToken, {}).expect(409)
  })
})

describe('PUT /tickets/:id/scheduled-date (TICKET-FR-004b, Flow 9 bước 6b)', () => {
  const path = (id: unknown) => `/tickets/${id}/scheduled-date`

  it('Technician được gán dời lịch ticket lắp đặt, có ghi chú + audit', async () => {
    const { ticket, assigneeToken } = await seed({ type: 'INSTALLATION', scheduled_visit_at: vnAt(1) })
    const at = vnAt(2, 14).toISOString()
    await put(path(ticket._id), assigneeToken, { scheduled_visit_at: at, reason: 'Kẹt lịch' }).expect(200)

    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.scheduled_visit_at!.toISOString()).toBe(at)
    expect(saved.notes.at(-1)!.content).toMatch(/Dời lịch hẹn.*Kẹt lịch/)
    expect(await AuditLog.countDocuments({ action: 'TICKET_RESCHEDULED' })).toBe(1)
  })

  it('bắt buộc lý do, giờ ở tương lai và trong 7:00–18:00, đúng người', async () => {
    const { ticket, assigneeToken, colleagueToken } = await seed({ type: 'INSTALLATION' })
    await put(path(ticket._id), assigneeToken, { scheduled_visit_at: vnAt(2).toISOString() }).expect(422) // thiếu lý do
    await put(path(ticket._id), assigneeToken, { scheduled_visit_at: new Date(Date.now() - 1000).toISOString(), reason: 'x' }).expect(400)
    await put(path(ticket._id), assigneeToken, { scheduled_visit_at: vnAt(2, 19).toISOString(), reason: 'x' }).expect(400)
    await put(path(ticket._id), assigneeToken, { scheduled_visit_at: vnAt(2, 6, 30).toISOString(), reason: 'x' }).expect(400)
    await put(path(ticket._id), colleagueToken, { scheduled_visit_at: vnAt(2).toISOString(), reason: 'x' }).expect(403)
  })

  it('ticket sự cố chỉ hẹn được sau khi đã tiếp nhận (IN_PROGRESS), Farm Owner được báo', async () => {
    const { ticket, owner, assigneeToken } = await seed({ type: 'SENSOR_FAULT', priority: 'P2' })
    await put(path(ticket._id), assigneeToken, { scheduled_visit_at: vnAt(1).toISOString(), reason: 'Cảm biến chết' }).expect(409)

    await Ticket.updateOne({ _id: ticket._id }, { status: 'IN_PROGRESS' })
    ;(notifyUser as jest.Mock).mockClear()
    await put(path(ticket._id), assigneeToken, { scheduled_visit_at: vnAt(1).toISOString(), reason: 'Reset từ xa không được' }).expect(200)

    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.notes.at(-1)!.content).toMatch(/Hẹn đến hiện trường.*Reset từ xa không được/)
    expect(await AuditLog.countDocuments({ action: 'TICKET_VISIT_SCHEDULED' })).toBe(1)
    expect((notifyUser as jest.Mock).mock.calls.map(c => String(c[0]))).toContain(String(owner._id))
  })
})

describe('SAT khi đóng ticket (TICKET-FR-010, Flow 9 bước 6b)', () => {
  const ALL_OK = { modbus_addresses_ok: true, camera_rtsp_ok: true, lte_connection_ok: true, relay_test_ok: true }

  it('ticket sự cố đã hẹn xuống hiện trường phải đủ SAT mới đóng được', async () => {
    const { ticket, assigneeToken } = await seed({ type: 'SENSOR_FAULT', priority: 'P2', status: 'IN_PROGRESS', scheduled_visit_at: vnAt(1) })
    await put(`/tickets/${ticket._id}/status`, assigneeToken, { status: 'CLOSED' }).expect(409)

    await put(`/tickets/${ticket._id}/sat-checklist`, assigneeToken, ALL_OK).expect(200)
    await put(`/tickets/${ticket._id}/status`, assigneeToken, { status: 'CLOSED' }).expect(200)
  })

  it('ticket sự cố xử lý từ xa (không có lịch hẹn) đóng thẳng, không dùng SAT', async () => {
    const { ticket, assigneeToken } = await seed({ type: 'SENSOR_FAULT', priority: 'P2', status: 'IN_PROGRESS' })
    await put(`/tickets/${ticket._id}/sat-checklist`, assigneeToken, ALL_OK).expect(400)
    await put(`/tickets/${ticket._id}/status`, assigneeToken, { status: 'CLOSED' }).expect(200)
  })
})

describe('POST /tickets — Farm Owner tạo ticket (TICKET-FR-001)', () => {
  const ownerCtx = async () => {
    const ctx = await seed()
    return { ...ctx, ownerToken: tokenFor(ctx.owner._id, 'FARM_OWNER') }
  }

  it('yêu cầu lắp đặt bắt buộc giờ hẹn hợp lệ; Technician được gán nhận thông báo kèm giờ hẹn', async () => {
    const { farm, ownerToken, colleague } = await ownerCtx()
    const body = { farm_id: String(farm._id), type: 'INSTALLATION' }
    await post('/tickets', ownerToken, body).expect(400)
    await post('/tickets', ownerToken, { ...body, scheduled_visit_at: vnAt(1, 20).toISOString() }).expect(400)
    await post('/tickets', ownerToken, { ...body, scheduled_visit_at: new Date(Date.now() - 60_000).toISOString() }).expect(400)

    ;(notifyUser as jest.Mock).mockClear()
    const res = await post('/tickets', ownerToken, { ...body, scheduled_visit_at: vnAt(1, 9).toISOString() }).expect(201)
    // seed() đã gán 1 ticket mở cho assignee → router chọn colleague (ít việc hơn)
    expect(res.body.data.assigned_to).toBe(String(colleague._id))
    const [to, message] = (notifyUser as jest.Mock).mock.calls[0]
    expect(String(to)).toBe(String(colleague._id))
    expect(message.body).toContain('hẹn')
  })

  it('ticket sự cố không kèm giờ hẹn khi tạo; ticket bảo trì không tạo tay; zone phải thuộc farm', async () => {
    const { farm, ownerToken, owner } = await ownerCtx()
    await post('/tickets', ownerToken, {
      farm_id: String(farm._id), type: 'SENSOR_FAULT', scheduled_visit_at: vnAt(1).toISOString(),
    }).expect(400)
    await post('/tickets', ownerToken, { farm_id: String(farm._id), type: 'MAINTENANCE', scheduled_visit_at: vnAt(1).toISOString() }).expect(422)
    await post('/tickets', ownerToken, { type: 'OTHER' }).expect(422) // thiếu farm_id

    const otherFarm = await Farm.create({ name: 'F2', address: 'x', region: 'HCMC', owner_id: owner._id })
    const house = await House.create({ farm_id: otherFarm._id, name: 'H' })
    const foreignZone = await Zone.create({ house_id: house._id, name: 'Z' })
    await post('/tickets', ownerToken, { farm_id: String(farm._id), zone_id: String(foreignZone._id), type: 'OTHER' }).expect(400)
    await post('/tickets', ownerToken, { farm_id: String(farm._id), type: 'SENSOR_FAULT', description: 'Cảm biến NH3 báo 0' }).expect(201)
  })

  it('huỷ ticket báo Technician đang giữ, kèm lịch hẹn không cần đến nữa', async () => {
    const { ticket, owner, assignee } = await seed({ type: 'INSTALLATION', scheduled_visit_at: vnAt(2) })
    ;(notifyUser as jest.Mock).mockClear()
    await put(`/tickets/${ticket._id}/cancel`, tokenFor(owner._id, 'FARM_OWNER'), { reason: 'Đổi ý' }).expect(200)

    const [to, message] = (notifyUser as jest.Mock).mock.calls[0]
    expect(String(to)).toBe(String(assignee._id))
    expect(message.body).toContain('không cần đến hiện trường')
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

  it('không đẩy ngược ticket về người đã từng từ chối', async () => {
    const { ticket, assigneeToken, colleague, colleagueToken } = await seed()
    await post(`/tickets/${ticket._id}/reassign-request`, assigneeToken, { reason: 'Nghỉ phép' }).expect(200)
    expect(String((await Ticket.findById(ticket._id))!.assigned_to)).toBe(String(colleague._id))

    // Người thứ hai cũng xin gán lại → không được trả về người đầu, ticket vào hàng đợi chung
    await post(`/tickets/${ticket._id}/reassign-request`, colleagueToken, { reason: 'Đang ở farm khác' }).expect(200)
    const saved = (await Ticket.findById(ticket._id))!
    expect(saved.assigned_to).toBeUndefined()
    expect(saved.previous_assignees).toHaveLength(2)
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

  it('Farm Owner luôn nhận thông báo dời lịch, kể cả ticket do Admin tạo hộ', async () => {
    const { farm, owner, assignee, assigneeToken } = await seed()
    const admin = await User.create({ email: 'admin2@test.vn', password_hash: 'password123', full_name: 'Admin', role: 'ADMIN' })
    const ticket = await Ticket.create({
      farm_id: farm._id, type: 'INSTALLATION', priority: 'P3', assigned_to: assignee._id,
      created_by: admin._id, scheduled_visit_at: vnAt(1),
    })
    ;(notifyUser as jest.Mock).mockClear()

    await put(`/tickets/${ticket._id}/scheduled-date`, assigneeToken, {
      scheduled_visit_at: vnAt(3).toISOString(), reason: 'Kẹt lịch',
    }).expect(200)

    const notified = (notifyUser as jest.Mock).mock.calls.map(c => String(c[0]))
    expect(notified).toContain(String(owner._id))  // người phải có mặt ở hiện trường
    expect(notified).toContain(String(admin._id))  // người tạo hộ cũng được báo
  })
})
