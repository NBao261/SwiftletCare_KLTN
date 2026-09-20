/**
 * TICKET-FR-009, SLA-NFR-002 — ticket quá hạn xử lý mà chưa đóng phải tự được
 * đánh dấu, không phụ thuộc vào việc Technician có bấm escalate hay không.
 * TICKET-FR-006 — SLA lấy từ cấu hình của Admin, không hard-code.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Ticket } from '@/models/ticket.model'
import { AuditLog } from '@/models/auditLog.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { markBreachedTickets } from '@/services/ticket.service'
import { getSlaHours, updateSlaHours } from '@/services/system.service'

let mongod: MongoMemoryServer
const farmId = new mongoose.Types.ObjectId()
const adminId = new mongoose.Types.ObjectId().toString()

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await SystemSetting.init()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await Promise.all([Ticket.deleteMany({}), AuditLog.deleteMany({}), SystemSetting.deleteMany({})])
})

/** Ticket có hạn xử lý đặt sẵn trong quá khứ/tương lai */
const createTicket = (resolveDueAt: Date, status = 'IN_PROGRESS') => Ticket.create({
  farm_id: farmId, type: 'OTHER', priority: 'P3', status,
  sla_resolve_due_at: resolveDueAt, is_sla_breached: false,
})

describe('markBreachedTickets', () => {
  it('đánh dấu ticket quá hạn còn mở', async () => {
    await createTicket(new Date(Date.now() - 3600_000))

    expect(await markBreachedTickets()).toBe(1)
    const ticket = await Ticket.findOne().lean()
    expect(ticket!.is_sla_breached).toBe(true)
    expect(ticket!.notes.at(-1)?.content).toContain('vượt hạn')
  })

  it('ghi audit log để Admin truy được', async () => {
    await createTicket(new Date(Date.now() - 3600_000))
    await markBreachedTickets()

    expect(await AuditLog.countDocuments({ action: 'TICKET_SLA_BREACHED' })).toBe(1)
  })

  it('bỏ qua ticket chưa tới hạn và ticket đã đóng', async () => {
    await createTicket(new Date(Date.now() + 3600_000))
    await createTicket(new Date(Date.now() - 3600_000), 'CLOSED')

    expect(await markBreachedTickets()).toBe(0)
  })

  it('không đánh dấu lại ticket đã bị đánh dấu (không sinh log trùng)', async () => {
    await createTicket(new Date(Date.now() - 3600_000))
    await markBreachedTickets()

    expect(await markBreachedTickets()).toBe(0)
    expect(await AuditLog.countDocuments({ action: 'TICKET_SLA_BREACHED' })).toBe(1)
  })
})

describe('SLA cấu hình được (TICKET-FR-006)', () => {
  it('dùng giá trị SRS đề xuất khi Admin chưa cấu hình', async () => {
    expect(await getSlaHours()).toMatchObject({
      P1: { response_hours: 0.5, resolve_hours: 4 },
      P3: { response_hours: 24, resolve_hours: 72 },
    })
  })

  it('lưu giá trị Admin đặt và giữ nguyên các mức không gửi lên', async () => {
    const saved = await updateSlaHours(adminId, { P3: { response_hours: 0.5, resolve_hours: 1 } })

    expect(saved.P3).toEqual({ response_hours: 0.5, resolve_hours: 1 })
    expect(saved.P1.resolve_hours).toBe(4)
    expect((await getSlaHours()).P3.resolve_hours).toBe(1)
  })

  it('gửi thiếu 1 trường thì giữ nguyên trường còn lại của mức đó', async () => {
    const saved = await updateSlaHours(adminId, { P2: { resolve_hours: 30 } })

    expect(saved.P2).toEqual({ response_hours: 4, resolve_hours: 30 })
  })

  it('từ chối hạn phản hồi muộn hơn hạn xử lý', async () => {
    await expect(updateSlaHours(adminId, { P2: { response_hours: 48, resolve_hours: 24 } }))
      .rejects.toThrow('hạn phản hồi không được muộn hơn')
  })

  it('từ chối giá trị không dương', async () => {
    await expect(updateSlaHours(adminId, { P1: { resolve_hours: 0 } })).rejects.toThrow('lớn hơn 0')
  })
})
