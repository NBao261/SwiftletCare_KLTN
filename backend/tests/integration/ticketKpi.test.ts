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

    const [row] = (await getKpi()).byTechnician
    expect(row.full_name).toBe('Trần Kỹ Thuật')
    expect(row.total).toBe(2)
    expect(row.avgResolveHours).toBe(2)
    expect(row.slaComplianceRate).toBe(50)
  })
})
