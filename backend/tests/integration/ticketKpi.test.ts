/**
 * TICKET-FR-012 — KPI của Admin.
 *
 * Bản trước cho số liệu đẹp giả tạo: ticket bị huỷ tính như ticket đã xử lý,
 * và tỉ lệ đúng SLA chỉ tính trên ticket đã đóng nên ticket trễ nhất (đang
 * treo) lại bị loại khỏi mẫu số.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Ticket } from '@/models/ticket.model'
import { getKpi } from '@/services/ticket.service'

let mongod: MongoMemoryServer
const farmId = new mongoose.Types.ObjectId()
const HOUR = 3600_000

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await Ticket.deleteMany({})
})

const baseTicket = { farm_id: farmId, type: 'OTHER' as const, priority: 'P3' as const }

describe('getKpi', () => {
  it('không tính ticket bị huỷ vào thời gian xử lý trung bình', async () => {
    const createdAt = new Date(Date.now() - 10 * HOUR)
    // 1 ticket xử lý thật mất 10 tiếng
    await Ticket.create({ ...baseTicket, status: 'CLOSED', created_at: createdAt, closed_at: new Date() })
    // 5 ticket huỷ sau 1 phút — bản cũ sẽ kéo trung bình xuống còn ~1.7 tiếng
    for (let i = 0; i < 5; i++) {
      const c = new Date(Date.now() - 60_000)
      await Ticket.create({ ...baseTicket, status: 'CLOSED', created_at: c, closed_at: new Date(), cancelled_at: new Date() })
    }

    const kpi = await getKpi()
    expect(kpi.resolvedTickets).toBe(1)
    expect(kpi.avgResolveHours).toBe(10)
  })

  it('tính ticket quá hạn còn treo vào tỉ lệ đúng SLA', async () => {
    // 1 ticket đóng đúng hạn
    await Ticket.create({
      ...baseTicket, status: 'CLOSED', closed_at: new Date(),
      sla_resolve_due_at: new Date(Date.now() - HOUR), is_sla_breached: false,
    })
    // 1 ticket quá hạn, chưa đóng, đã bị job đánh dấu
    await Ticket.create({
      ...baseTicket, status: 'IN_PROGRESS',
      sla_resolve_due_at: new Date(Date.now() - HOUR), is_sla_breached: true,
    })

    const kpi = await getKpi()
    expect(kpi.ticketsPastDue).toBe(2)
    expect(kpi.slaComplianceRate).toBe(50)
  })

  it('chưa tới hạn thì không đưa vào mẫu số', async () => {
    await Ticket.create({
      ...baseTicket, status: 'IN_PROGRESS', sla_resolve_due_at: new Date(Date.now() + HOUR),
    })

    const kpi = await getKpi()
    expect(kpi.ticketsPastDue).toBe(0)
    expect(kpi.slaComplianceRate).toBeNull()
  })

  it('thống kê theo Technician kèm tên và tỉ lệ SLA riêng', async () => {
    const techId = new mongoose.Types.ObjectId()
    await mongoose.connection.db!.collection('users').insertOne({
      _id: techId, full_name: 'Trần Kỹ Thuật', email: 'tech@e2e.dev', role: 'TECHNICIAN',
    })
    await Ticket.create({
      ...baseTicket, assigned_to: techId, status: 'CLOSED', closed_at: new Date(),
      created_at: new Date(Date.now() - 2 * HOUR),
      sla_resolve_due_at: new Date(Date.now() - HOUR), is_sla_breached: false,
    })
    await Ticket.create({
      ...baseTicket, assigned_to: techId, status: 'IN_PROGRESS',
      sla_resolve_due_at: new Date(Date.now() - HOUR), is_sla_breached: true,
    })

    await Ticket.create({ ...baseTicket, assigned_to: techId, status: 'NEW' })

    const [row] = (await getKpi()).byTechnician
    expect(row.full_name).toBe('Trần Kỹ Thuật')
    expect(row.total).toBe(3)
    expect(row.unaccepted).toBe(1)
    expect(row.avgResolveHours).toBe(2)
    expect(row.slaComplianceRate).toBe(50)
  })
})

describe('getKpi — theo từng lượt phụ trách', () => {
  const techA = new mongoose.Types.ObjectId()
  const techB = new mongoose.Types.ObjectId()
  const rowOf = (kpi: Awaited<ReturnType<typeof getKpi>>, id: unknown) => kpi.byTechnician.find(r => r.technician_id === String(id))!

  it('credits each part of a handed-over ticket to whoever held it at the time', async () => {
    const created = new Date(Date.now() - 10 * HOUR)
    const bStart = new Date(Date.now() - 2 * HOUR)
    await Ticket.create({
      ...baseTicket, created_at: created, status: 'CLOSED', closed_at: new Date(),
      // A giữ 8 tiếng, trễ phản hồi rồi xin gán lại; B nhận, tiếp nhận sau 30 phút, đóng sau 2 tiếng
      assignment_history: [{ user_id: techA, assigned_at: created, ended_at: bStart, end_reason: 'REASSIGN_REQUESTED', response_breached: true }],
      assigned_to: techB, assigned_at: bStart, responded_at: new Date(bStart.getTime() + 0.5 * HOUR),
      // Vi phạm hạn xử lý xảy ra lúc A còn giữ ticket
      sla_resolve_due_at: new Date(Date.now() - 3 * HOUR), is_sla_breached: true, sla_breached_by: techA,
    })

    const kpi = await getKpi()
    const a = rowOf(kpi, techA)
    const b = rowOf(kpi, techB)

    expect(a).toMatchObject({ total: 1, reassignRequests: 1, responseBreaches: 1, closed: 0, slaComplianceRate: 0 })
    expect(b).toMatchObject({ total: 1, reassignRequests: 0, responseBreaches: 0, closed: 1, avgResponseHours: 0.5 })
    // B bị tính 2 tiếng của chính mình, không phải 10 tiếng từ lúc tạo ticket
    expect(b.avgResolveHours).toBe(2)
    expect(b.slaComplianceRate).toBeNull() // vi phạm không phải của B
    // Hệ thống vẫn tính cam kết với khách theo ticket: tạo → đóng
    expect(kpi.avgResolveHours).toBe(10)
  })

  it('counts reopened tickets against whoever held them when they were closed', async () => {
    await Ticket.create({
      ...baseTicket, status: 'CLOSED', closed_at: new Date(), assigned_to: techA, assigned_at: new Date(Date.now() - HOUR),
    })
    await Ticket.create({
      ...baseTicket, status: 'IN_PROGRESS', assigned_to: techA, assigned_at: new Date(Date.now() - HOUR),
      reopen_history: [{ reopened_at: new Date(), holder_at_close: techA, reason: 'Khách báo lỗi lại' }],
    })

    const kpi = await getKpi()
    expect(rowOf(kpi, techA)).toMatchObject({ reopened: 1, reopenRate: 100 })
    expect(kpi.reopenedTickets).toBe(1)
  })

  it('only counts the requested period (30 days by default)', async () => {
    const old = new Date(Date.now() - 40 * 24 * HOUR)
    await Ticket.create({ ...baseTicket, status: 'CLOSED', created_at: old, closed_at: new Date(old.getTime() + HOUR) })

    expect((await getKpi()).resolvedTickets).toBe(0)
    const wide = await getKpi({ from: new Date(Date.now() - 60 * 24 * HOUR).toISOString() })
    expect(wide.resolvedTickets).toBe(1)
    expect(wide.period.from).toBeInstanceOf(Date)
  })

  it('rejects a reversed or too long period', async () => {
    const now = Date.now()
    await expect(getKpi({ from: new Date(now).toISOString(), to: new Date(now - HOUR).toISOString() }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(getKpi({ from: new Date(now - 400 * 24 * HOUR).toISOString() })).rejects.toMatchObject({ statusCode: 400 })
  })
})
