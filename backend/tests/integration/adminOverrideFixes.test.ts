/**
 * Rà soát Admin vòng 2, lỗi 1–4: Admin đổi ưu tiên (hạn SLA đúng mốc, gỡ cờ vi phạm
 * khi hạn mới chưa tới), ép CLOSED ticket đã đóng, ép rời NEW thì ghi mốc tiếp nhận.
 * (Lỗi 2 — Admin tạo farm hộ — đã bỏ: Report 3 §2.4 không cho Admin quản lý farm.) SLA mặc định: P1 30 phút / 4 giờ, P3 24 giờ / 72 giờ.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { adminOverrideTicket } from '@/services/ticket.service'
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
  await Promise.all([AuditLog.deleteMany({}), Farm.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({})])
})

const MIN = 60_000
const HOUR = 60 * MIN
const ago = (ms: number) => new Date(Date.now() - ms)
let seq = 0
const mkUser = (role: CurrentUser['role'], extra: object = {}) =>
  User.create({ email: `f${++seq}@test.vn`, password_hash: 'password123', full_name: `User ${seq}`, role, ...extra })
const asCurrent = (u: { _id: unknown; email: string; role: CurrentUser['role'] }): CurrentUser =>
  ({ _id: String(u._id), email: u.email, role: u.role })

async function seed(ticketFields: object) {
  const admin = asCurrent(await mkUser('ADMIN'))
  const owner = await mkUser('FARM_OWNER')
  const tech = await mkUser('TECHNICIAN', { assigned_regions: ['HCMC'] })
  const farm = await Farm.create({ name: 'F', address: 'x', region: 'HCMC', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  const ticket = await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'NEW', assigned_to: tech._id, ...ticketFields })
  return { admin, tech, ticket }
}
const override = (admin: CurrentUser, ticketId: unknown, body: object) =>
  adminOverrideTicket(String(ticketId), admin, { reason: 'Admin xử lý', ...body })

describe('lỗi 1 — Admin đổi ưu tiên', () => {
  it('counts the response deadline from when the current holder got the ticket, not from creation', async () => {
    const assignedAt = ago(10 * MIN)
    const { admin, ticket } = await seed({ created_at: ago(2 * HOUR), assigned_at: assignedAt })

    const after = await override(admin, ticket._id, { priority: 'P1' })

    expect(after.sla_response_due_at!.getTime()).toBe(assignedAt.getTime() + 30 * MIN)
    expect(after.is_sla_response_breached).toBe(false)
    expect(after.sla_resolve_due_at!.getTime()).toBe(ticket.created_at.getTime() + 4 * HOUR)
  })

  it('clears breach flags when a lower priority moves the deadlines into the future', async () => {
    const { admin, tech, ticket } = await seed({
      priority: 'P1', created_at: ago(5 * HOUR), assigned_at: ago(5 * HOUR),
      is_sla_breached: true, is_sla_response_breached: true,
    })
    await Ticket.updateOne({ _id: ticket._id }, { sla_breached_by: tech._id })

    const after = await override(admin, ticket._id, { priority: 'P3' })

    expect(after.is_sla_breached).toBe(false)
    expect(after.sla_breached_by).toBeUndefined()
    expect(after.is_sla_response_breached).toBe(false)
  })

  it('leaves a still-overdue open ticket to the SLA job instead of flagging it silently', async () => {
    const { admin, ticket } = await seed({ created_at: ago(5 * HOUR), assigned_at: ago(5 * HOUR) })

    const after = await override(admin, ticket._id, { priority: 'P1' })

    // Hạn mới đã qua nhưng cờ để job bật (kèm ghi chú + báo Admin)
    expect(after.sla_resolve_due_at!.getTime()).toBeLessThan(Date.now())
    expect(after.is_sla_breached).toBe(false)
  })

  it('re-judges a closed ticket exactly against the new deadline and records who held it', async () => {
    const { admin, tech, ticket } = await seed({
      status: 'CLOSED', created_at: ago(20 * HOUR), assigned_at: ago(20 * HOUR), responded_at: ago(19 * HOUR), closed_at: ago(10 * HOUR),
    })

    const after = await override(admin, ticket._id, { priority: 'P1' })

    // Đóng sau 10 tiếng > hạn 4 tiếng của P1; tiếp nhận sau 1 tiếng > hạn 30 phút
    expect(after.is_sla_breached).toBe(true)
    expect(String(after.sla_breached_by)).toBe(String(tech._id))
    expect(after.is_sla_response_breached).toBe(true)
  })
})

describe('lỗi 3 — ép CLOSED ticket đã đóng', () => {
  it('keeps the original closing time', async () => {
    const closedAt = ago(3 * HOUR)
    const { admin, ticket } = await seed({ status: 'CLOSED', closed_at: closedAt })

    const after = await override(admin, ticket._id, { status: 'CLOSED' })

    expect(after.closed_at!.getTime()).toBe(closedAt.getTime())
  })

  it('still stamps the closing time when the ticket really goes to CLOSED', async () => {
    const { admin, ticket } = await seed({ status: 'IN_PROGRESS', responded_at: ago(HOUR) })
    const after = await override(admin, ticket._id, { status: 'CLOSED' })
    expect(after.closed_at!.getTime()).toBeGreaterThan(Date.now() - MIN)
  })
})

describe('lỗi 4 — ép rời NEW thì ghi mốc tiếp nhận', () => {
  it.each(['IN_PROGRESS', 'CLOSED'] as const)('records responded_at when forcing NEW → %s', async status => {
    const { admin, ticket } = await seed({ assigned_at: ago(HOUR) })

    const after = await override(admin, ticket._id, { status })

    expect(after.responded_at).toBeInstanceOf(Date)
  })

  it('keeps an earlier responded_at and does not invent one for a ticket nobody holds', async () => {
    const respondedAt = ago(2 * HOUR)
    const { admin, ticket } = await seed({ status: 'AWAITING_FIELD_CONFIRMATION', responded_at: respondedAt })
    const kept = await override(admin, ticket._id, { status: 'IN_PROGRESS' })
    expect(kept.responded_at!.getTime()).toBe(respondedAt.getTime())

    const queued = await Ticket.create({ farm_id: ticket.farm_id, type: 'OTHER', priority: 'P3', status: 'NEW' })
    const after = await override(admin, queued._id, { status: 'IN_PROGRESS' })
    expect(after.responded_at).toBeUndefined()
  })
})
