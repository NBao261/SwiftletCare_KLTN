/**
 * TICKET-FR-012 — các đường đổi người ghi lại lượt phụ trách cũ (`assignment_history`),
 * job SLA ghi người chịu vi phạm, và Admin mở lại ticket đã đóng (hạn xử lý mới, giữ
 * cờ vi phạm cũ, lịch sử mở lại, báo Farm Owner + người phụ trách).
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Ticket } from '@/models/ticket.model'
import { TicketMessage } from '@/models/ticketMessage.model'
import { User } from '@/models/user.model'
import { setUserStatus } from '@/services/admin.service'
import { adminOverrideTicket, markBreachedTickets, requestReassign } from '@/services/ticket.service'
import { notifyUser } from '@/services/notification.service'
import type { CurrentUser } from '@/types'

jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

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
  jest.clearAllMocks()
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), Ticket.deleteMany({}), TicketMessage.deleteMany({}), User.deleteMany({}),
  ])
})

const HOUR = 3600_000
let seq = 0
const mkUser = (role: CurrentUser['role'], extra: object = {}) =>
  User.create({ email: `h${++seq}@test.vn`, password_hash: 'password123', full_name: `User ${seq}`, role, ...extra })
const asCurrent = (u: { _id: unknown; email: string; role: CurrentUser['role']; assigned_regions?: string[] }): CurrentUser =>
  ({ _id: String(u._id), email: u.email, role: u.role, assigned_regions: u.assigned_regions })

async function seed() {
  const admin = await mkUser('ADMIN')
  const owner = await mkUser('FARM_OWNER')
  const farm = await Farm.create({ name: 'F', address: 'x', region: 'HCMC', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const techA = await mkUser('TECHNICIAN', { assigned_regions: ['HCMC'] })
  const techB = await mkUser('TECHNICIAN', { assigned_regions: ['HCMC'] })
  const assignedAt = new Date(Date.now() - 3 * HOUR)
  const respondedAt = new Date(Date.now() - 2 * HOUR)
  const ticket = await Ticket.create({
    farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'IN_PROGRESS',
    assigned_to: techA._id, assigned_at: assignedAt, responded_at: respondedAt, is_sla_response_breached: true,
  })
  return { admin, owner, farm, techA, techB, ticket, assignedAt, respondedAt }
}

describe('assignment_history — mỗi đường đổi người chốt lượt cũ với đúng mốc của nó', () => {
  it('technician asks to be reassigned', async () => {
    const { techA, techB, ticket, assignedAt, respondedAt } = await seed()

    await requestReassign(String(ticket._id), asCurrent(techA), 'Đang nghỉ phép')

    const after = (await Ticket.findById(ticket._id))!
    expect(after.assignment_history).toHaveLength(1)
    expect(after.assignment_history[0]).toMatchObject({
      end_reason: 'REASSIGN_REQUESTED', assigned_at: assignedAt, responded_at: respondedAt, response_breached: true,
    })
    expect(String(after.assignment_history[0].user_id)).toBe(String(techA._id))
    // Lượt mới của B bắt đầu sạch
    expect(String(after.assigned_to)).toBe(String(techB._id))
    expect(after.is_sla_response_breached).toBe(false)
  })

  it('admin reassigns, admin unassigns, and an account lock reroutes', async () => {
    const { admin, techA, techB, ticket } = await seed()

    await adminOverrideTicket(String(ticket._id), asCurrent(admin), { assigned_to: String(techB._id), reason: 'Điều phối' })
    await adminOverrideTicket(String(ticket._id), asCurrent(admin), { assigned_to: null, reason: 'Trả về' })
    // A và B đều đã từng phụ trách nên hàng đợi không chia lại — gán tay lại cho A rồi khoá A
    await adminOverrideTicket(String(ticket._id), asCurrent(admin), { assigned_to: String(techA._id), reason: 'Gán lại' })
    await setUserStatus(String(admin._id), String(techA._id), false, 'Nghỉ việc')

    const reasons = (await Ticket.findById(ticket._id))!.assignment_history.map(h => h.end_reason)
    expect(reasons).toEqual(['ADMIN_REASSIGNED', 'ADMIN_UNASSIGNED', 'REROUTED_ACCOUNT_LOCKED'])
  })

  it('the SLA job records who held the ticket when it went overdue', async () => {
    const { techA, ticket } = await seed()
    await Ticket.updateOne({ _id: ticket._id }, { sla_resolve_due_at: new Date(Date.now() - HOUR) })

    await markBreachedTickets()

    expect(String((await Ticket.findById(ticket._id))!.sla_breached_by)).toBe(String(techA._id))
  })
})

describe('Admin mở lại ticket đã đóng', () => {
  async function closedTicket() {
    const base = await seed()
    await Ticket.updateOne({ _id: base.ticket._id }, {
      status: 'CLOSED', closed_at: new Date(), is_sla_breached: true, sla_resolve_due_at: new Date(Date.now() - HOUR),
    })
    return base
  }

  it('keeps the old breach, sets a fresh resolve deadline and records the reopen', async () => {
    const { admin, techA, ticket } = await closedTicket()

    const after = await adminOverrideTicket(String(ticket._id), asCurrent(admin), { status: 'IN_PROGRESS', reason: 'Khách báo lỗi lại' })

    expect(after.status).toBe('IN_PROGRESS')
    expect(after.closed_at).toBeUndefined()
    expect(after.is_sla_breached).toBe(true)
    // P3 = 72 giờ tính từ lúc mở lại
    expect(after.sla_resolve_due_at!.getTime()).toBeGreaterThan(Date.now() + 71 * HOUR)
    expect(after.reopen_history).toHaveLength(1)
    expect(String(after.reopen_history[0].holder_at_close)).toBe(String(techA._id))
    // Cùng người, vẫn đang xử lý → không mở lượt phụ trách mới
    expect(after.assignment_history).toHaveLength(0)
  })

  it('makes the same holder accept again when the admin reopens it as NEW', async () => {
    const { admin, techA, ticket, assignedAt } = await closedTicket()

    const after = await adminOverrideTicket(String(ticket._id), asCurrent(admin), { status: 'NEW', reason: 'Làm lại từ đầu' })

    expect(after.responded_at).toBeUndefined()
    expect(after.assigned_at!.getTime()).toBeGreaterThan(assignedAt.getTime())
    expect(after.assignment_history.map(h => h.end_reason)).toEqual(['REOPENED'])
    expect(String((await Ticket.findById(ticket._id))!.assigned_to)).toBe(String(techA._id))
  })

  it('tells the farm owner and the technician', async () => {
    const { admin, owner, techA, ticket } = await closedTicket()

    await adminOverrideTicket(String(ticket._id), asCurrent(admin), { status: 'IN_PROGRESS', reason: 'Khách báo lỗi lại' })

    const reopenNotices = (notifyUser as jest.Mock).mock.calls.filter(c => c[1].title === 'Ticket được mở lại').map(c => c[0])
    expect(reopenNotices.sort()).toEqual([String(owner._id), String(techA._id)].sort())
  })
})
