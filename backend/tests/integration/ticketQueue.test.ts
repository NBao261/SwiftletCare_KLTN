/**
 * TICKET-FR-005 — hàng đợi ticket chung: Router hoà điểm công bằng, tự chia lại hàng
 * đợi (thứ tự, loại người từng phụ trách, các thao tác kích hoạt), Admin trả ticket
 * về hàng đợi. Chạy trên MongoDB in-memory.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Ticket } from '@/models/ticket.model'
import { TicketMessage } from '@/models/ticketMessage.model'
import { User } from '@/models/user.model'
import { createTechnician, setUserStatus, updateTechnicianRegions } from '@/services/admin.service'
import { adminOverrideTicket, createTicket, drainUnassignedQueue, updateStatus } from '@/services/ticket.service'
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
    AuditLog.deleteMany({}), Farm.deleteMany({}), Ticket.deleteMany({}),
    TicketMessage.deleteMany({}), User.deleteMany({}),
  ])
})

let seq = 0
const mkUser = (role: 'ADMIN' | 'FARM_OWNER' | 'TECHNICIAN', extra: object = {}) =>
  User.create({ email: `u${++seq}@test.vn`, password_hash: 'password123', full_name: `User ${seq}`, role, ...extra })
const mkTech = (regions: string[] = ['HCMC'], extra: object = {}) => mkUser('TECHNICIAN', { assigned_regions: regions, ...extra })
const asCurrent = (u: { _id: unknown; email: string; role: CurrentUser['role']; assigned_regions?: string[] }): CurrentUser =>
  ({ _id: String(u._id), email: u.email, role: u.role, assigned_regions: u.assigned_regions })

async function mkFarm(region = 'HCMC') {
  const owner = await mkUser('FARM_OWNER')
  return Farm.create({ name: 'Farm', address: 'x', region, owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
}
const mkQueued = (farmId: unknown, extra: object = {}) =>
  Ticket.create({ farm_id: farmId, type: 'OTHER', priority: 'P3', status: 'NEW', ...extra })
const holderOf = async (ticketId: unknown) => {
  const t = await Ticket.findById(ticketId)
  return t?.assigned_to ? String(t.assigned_to) : null
}

describe('Router — hoà điểm', () => {
  it('gives the ticket to the technician who has waited longest since their last assignment', async () => {
    const admin = await mkUser('ADMIN')
    const farm = await mkFarm()
    const busyLately = await mkTech()
    const idleLong = await mkTech()
    // Cả hai đều 0 ticket mở; người tạo trước (busyLately) vừa được giao gần đây hơn
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'CLOSED', assigned_to: busyLately._id, assigned_at: new Date() })
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'CLOSED', assigned_to: idleLong._id, assigned_at: new Date(Date.now() - 86_400_000) })

    const ticket = await createTicket(asCurrent(admin), { farm_id: String(farm._id), type: 'OTHER' })

    expect(String(ticket.assigned_to)).toBe(String(idleLong._id))
  })

  it('still prefers fewer open tickets over a longer wait', async () => {
    const admin = await mkUser('ADMIN')
    const farm = await mkFarm()
    const loaded = await mkTech()
    const free = await mkTech()
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'IN_PROGRESS', assigned_to: loaded._id, assigned_at: new Date(Date.now() - 86_400_000) })
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'CLOSED', assigned_to: free._id, assigned_at: new Date() })

    const ticket = await createTicket(asCurrent(admin), { farm_id: String(farm._id), type: 'OTHER' })

    expect(String(ticket.assigned_to)).toBe(String(free._id))
  })
})

describe('drainUnassignedQueue', () => {
  it('assigns urgent and older tickets first and stops when nobody has capacity', async () => {
    const farm = await mkFarm()
    const tech = await mkTech()
    // Ngưỡng mặc định 10 — cho người này sẵn 9 ticket mở để chỉ còn đúng 1 suất
    await Ticket.insertMany(Array.from({ length: 9 }, () => ({
      farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'IN_PROGRESS', assigned_to: tech._id, assigned_at: new Date(),
    })))
    const oldP3 = await mkQueued(farm._id, { created_at: new Date(Date.now() - 3_600_000) })
    const newP1 = await mkQueued(farm._id, { priority: 'P1' })

    const assigned = await drainUnassignedQueue()

    expect(assigned).toEqual([String(newP1._id)])
    expect(await holderOf(newP1._id)).toBe(String(tech._id))
    expect(await holderOf(oldP3._id)).toBeNull()
  })

  it('sets a fresh response deadline, notifies the technician and audits the assignment', async () => {
    const farm = await mkFarm()
    const tech = await mkTech()
    const queued = await mkQueued(farm._id, { is_sla_response_breached: true, sla_response_due_at: new Date(Date.now() - 1000) })

    await drainUnassignedQueue()

    const after = (await Ticket.findById(queued._id))!
    expect(after.status).toBe('NEW')
    expect(after.assigned_at).toBeInstanceOf(Date)
    expect(after.is_sla_response_breached).toBe(false)
    expect(after.sla_response_due_at!.getTime()).toBeGreaterThan(Date.now())
    expect(notifyUser).toHaveBeenCalledWith(String(tech._id), expect.objectContaining({ title: expect.stringContaining('Bạn được gán ticket') }))
    expect(await AuditLog.countDocuments({ action: 'TICKET_AUTO_ASSIGNED' })).toBe(1)
  })

  it('never hands a ticket back to someone who already gave it up', async () => {
    const farm = await mkFarm()
    const declined = await mkTech()
    const queued = await mkQueued(farm._id, { previous_assignees: [{ user_id: declined._id, until: new Date() }] })

    expect(await drainUnassignedQueue()).toEqual([])
    expect(await holderOf(queued._id)).toBeNull()
  })

  it('only looks at the given regions', async () => {
    const hcmc = await mkFarm('HCMC')
    const longAn = await mkFarm('Long An')
    await mkTech(['HCMC', 'Long An'])
    const a = await mkQueued(hcmc._id)
    const b = await mkQueued(longAn._id)

    await drainUnassignedQueue({ regions: ['Long An'] })

    expect(await holderOf(a._id)).toBeNull()
    expect(await holderOf(b._id)).not.toBeNull()
  })
})

describe('các thao tác tự chia lại hàng đợi', () => {
  it('a newly created technician picks up the queue of their region', async () => {
    const admin = await mkUser('ADMIN')
    const farm = await mkFarm()
    const queued = await mkQueued(farm._id)

    const tech = await createTechnician(String(admin._id), {
      email: 'new@test.vn', password: 'password123', full_name: 'Tech mới', assigned_regions: ['HCMC'],
    })

    expect(await holderOf(queued._id)).toBe(String(tech._id))
  })

  it('adding a region to a technician pulls the waiting tickets of that region', async () => {
    const admin = await mkUser('ADMIN')
    const farm = await mkFarm('TAY_NINH')
    const tech = await mkTech(['HCMC'])
    const queued = await mkQueued(farm._id)

    // Gõ tên tỉnh cũ "Long An" — backend quy về mã TAY_NINH nên vẫn khớp farm
    await updateTechnicianRegions(String(admin._id), String(tech._id), ['HCMC', 'Long An'])

    expect(await holderOf(queued._id)).toBe(String(tech._id))
  })

  it('unlocking a technician gives them the waiting tickets of their region', async () => {
    const admin = await mkUser('ADMIN')
    const farm = await mkFarm()
    const tech = await mkTech(['HCMC'], { is_active: false })
    const queued = await mkQueued(farm._id)

    await setUserStatus(String(admin._id), String(tech._id), true)

    expect(await holderOf(queued._id)).toBe(String(tech._id))
  })

  it('closing a ticket lets the technician take the next one waiting in the region', async () => {
    const farm = await mkFarm()
    const tech = await mkTech()
    await Ticket.insertMany(Array.from({ length: 9 }, () => ({
      farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'IN_PROGRESS', assigned_to: tech._id, assigned_at: new Date(),
    })))
    const toClose = await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'IN_PROGRESS', assigned_to: tech._id, assigned_at: new Date() })
    const queued = await mkQueued(farm._id)

    await updateStatus(String(toClose._id), asCurrent(tech), 'CLOSED')

    expect(await holderOf(queued._id)).toBe(String(tech._id))
  })
})

describe('Admin trả ticket về hàng đợi (assigned_to: null)', () => {
  async function seed() {
    const admin = await mkUser('ADMIN')
    const farm = await mkFarm()
    const holder = await mkTech()
    const ticket = await Ticket.create({
      farm_id: farm._id, type: 'SENSOR_FAULT', priority: 'P2', status: 'IN_PROGRESS',
      assigned_to: holder._id, assigned_at: new Date(), responded_at: new Date(),
      scheduled_visit_at: new Date(Date.now() + 86_400_000),
    })
    return { admin: asCurrent(admin), holder, ticket }
  }

  it('unassigns, resets to NEW, drops the incident visit and tells the former holder', async () => {
    const { admin, holder, ticket } = await seed()

    const after = await adminOverrideTicket(String(ticket._id), admin, { assigned_to: null, reason: 'Người này nghỉ phép' })

    expect(after.assigned_to).toBeFalsy()
    expect(after.status).toBe('NEW')
    expect(after.responded_at).toBeUndefined()
    expect(after.scheduled_visit_at).toBeUndefined()
    expect(after.previous_assignees.map(p => String(p.user_id))).toContain(String(holder._id))
    expect(notifyUser).toHaveBeenCalledWith(String(holder._id), expect.objectContaining({ title: 'Ticket đã được gỡ khỏi bạn' }))
  })

  it('hands the ticket straight to another free technician of the region, never back to the former holder', async () => {
    const { admin, holder, ticket } = await seed()
    const colleague = await mkTech()

    await adminOverrideTicket(String(ticket._id), admin, { assigned_to: null, reason: 'Đổi người' })

    expect(await holderOf(ticket._id)).toBe(String(colleague._id))
    expect(await holderOf(ticket._id)).not.toBe(String(holder._id))
  })

  it('refuses a closed ticket, an already-queued ticket and a non-NEW status', async () => {
    const { admin, ticket } = await seed()
    const farm = await mkFarm()
    const closed = await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'CLOSED', assigned_to: new mongoose.Types.ObjectId() })
    const queued = await mkQueued(farm._id)

    await expect(adminOverrideTicket(String(closed._id), admin, { assigned_to: null, reason: 'x' })).rejects.toMatchObject({ statusCode: 409 })
    await expect(adminOverrideTicket(String(queued._id), admin, { assigned_to: null, reason: 'x' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(adminOverrideTicket(String(ticket._id), admin, { assigned_to: null, status: 'IN_PROGRESS', reason: 'x' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})
