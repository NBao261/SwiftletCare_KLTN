/**
 * Tìm kiếm / sắp xếp / lọc quá hạn SLA cho GET /tickets và thống kê riêng của
 * Technician GET /tickets/stats/me. Trọng tâm: mọi thứ tính trên DB nên đúng cả
 * khi vượt một trang, và không bao giờ lộ ticket ngoài farm được phép xem.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import ticketRoutes from '@/routes/tickets.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Farm } from '@/models/farm.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
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
  await Promise.all([Farm.deleteMany({}), Ticket.deleteMany({}), User.deleteMany({})])
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

const HOUR = 60 * 60 * 1000
const past = () => new Date(Date.now() - HOUR)
const future = () => new Date(Date.now() + HOUR)

async function seed() {
  const owner = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const tech = await User.create({
    email: 'tech@test.vn', password_hash: 'password123', full_name: 'Tech', role: 'TECHNICIAN', assigned_regions: ['HCMC'],
  })
  const otherTech = await User.create({
    email: 'other@test.vn', password_hash: 'password123', full_name: 'Other', role: 'TECHNICIAN', assigned_regions: ['HN'],
  })
  const farm = await Farm.create({ name: 'Trại Yến Cần Giờ', address: 'HCMC', region: 'HCMC', owner_id: owner._id })
  const farmB = await Farm.create({ name: 'Trại Bình Chánh', address: 'HCMC', region: 'HCMC', owner_id: owner._id })
  const farmHN = await Farm.create({ name: 'Trại Hà Nội', address: 'HN', region: 'HN', owner_id: owner._id })
  return {
    owner, tech, otherTech, farm, farmB, farmHN,
    techToken: tokenFor(tech._id, 'TECHNICIAN'),
    otherTechToken: tokenFor(otherTech._id, 'TECHNICIAN'),
    ownerToken: tokenFor(owner._id, 'FARM_OWNER'),
  }
}

const list = (token: string, qs: string) =>
  request(app).get(`/tickets?${qs}`).set('Authorization', `Bearer ${token}`)

describe('GET /tickets — sort', () => {
  it('sắp theo trạng thái đúng thứ tự nghiệp vụ, không theo chữ cái', async () => {
    const { tech, farm, techToken } = await seed()
    for (const status of ['CLOSED', 'NEW', 'AWAITING_FIELD_CONFIRMATION', 'IN_PROGRESS']) {
      await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status, assigned_to: tech._id })
    }

    const res = await list(techToken, 'assignedToMe=true&sort=status&order=asc')

    expect(res.status).toBe(200)
    expect(res.body.data.map((t: { status: string }) => t.status))
      .toEqual(['NEW', 'IN_PROGRESS', 'AWAITING_FIELD_CONFIRMATION', 'CLOSED'])
    expect(res.body.data[0]).not.toHaveProperty('_status_rank')
    expect(res.body.data[0].assigned_to).toMatchObject({ full_name: 'Tech' })
  })

  it('sắp theo priority và theo hạn SLA', async () => {
    const { tech, farm, techToken } = await seed()
    const base = { farm_id: farm._id, type: 'OTHER', assigned_to: tech._id }
    await Ticket.create({ ...base, priority: 'P2', sla_resolve_due_at: new Date(Date.now() + 3 * HOUR) })
    await Ticket.create({ ...base, priority: 'P3', sla_resolve_due_at: new Date(Date.now() + 1 * HOUR) })
    await Ticket.create({ ...base, priority: 'P1', sla_resolve_due_at: new Date(Date.now() + 2 * HOUR) })

    const byPriority = await list(techToken, 'sort=priority&order=asc')
    expect(byPriority.body.data.map((t: { priority: string }) => t.priority)).toEqual(['P1', 'P2', 'P3'])

    const bySla = await list(techToken, 'sort=sla&order=asc')
    expect(bySla.body.data.map((t: { priority: string }) => t.priority)).toEqual(['P3', 'P1', 'P2'])
  })

  it('sắp trên toàn bộ dữ liệu nên trang 2 vẫn đúng thứ tự', async () => {
    const { tech, farm, techToken } = await seed()
    for (let i = 0; i < 5; i++) {
      await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: i < 2 ? 'P1' : 'P3', assigned_to: tech._id })
    }

    const page2 = await list(techToken, 'sort=priority&order=desc&limit=2&page=2')

    expect(page2.body.meta).toMatchObject({ total: 5, page: 2, limit: 2 })
    // desc: 3 ticket P3 trước, rồi 2 ticket P1 → trang 2 = [P3, P1]
    expect(page2.body.data.map((t: { priority: string }) => t.priority)).toEqual(['P3', 'P1'])
  })

  it('order=asc theo ngày tạo đưa ticket cũ nhất lên đầu, kể cả khi không truyền sort', async () => {
    const { tech, farm, techToken } = await seed()
    const base = { farm_id: farm._id, type: 'OTHER', priority: 'P3', assigned_to: tech._id }
    const oldest = await Ticket.create({ ...base, created_at: new Date(Date.now() - 3 * HOUR) })
    await Ticket.create({ ...base, created_at: new Date(Date.now() - 2 * HOUR) })
    const newest = await Ticket.create({ ...base, created_at: new Date(Date.now() - 1 * HOUR) })
    const firstId = (res: request.Response) => res.body.data[0]._id

    expect(firstId(await list(techToken, 'order=asc'))).toBe(String(oldest._id))
    expect(firstId(await list(techToken, 'sort=created_at&order=asc'))).toBe(String(oldest._id))
    expect(firstId(await list(techToken, 'sort=created_at&order=desc'))).toBe(String(newest._id))
    expect(firstId(await list(techToken, 'assignedToMe=true'))).toBe(String(newest._id)) // mặc định
  })

  it('từ chối cột sắp xếp lạ', async () => {
    const { techToken } = await seed()
    const res = await list(techToken, 'sort=password_hash')
    expect(res.status).toBe(422)
  })
})

describe('GET /tickets?slaBreached=true', () => {
  it('lấy ticket đã bị đánh dấu hoặc còn mở mà đã qua hạn, bỏ ticket đóng đúng hạn', async () => {
    const { tech, farm, techToken } = await seed()
    const base = { farm_id: farm._id, type: 'OTHER', priority: 'P2', assigned_to: tech._id }
    const flaggedClosed = await Ticket.create({ ...base, status: 'CLOSED', is_sla_breached: true, sla_resolve_due_at: past() })
    const overdueOpen = await Ticket.create({ ...base, status: 'IN_PROGRESS', sla_resolve_due_at: past() })
    await Ticket.create({ ...base, status: 'CLOSED', sla_resolve_due_at: past() }) // đóng trước hạn
    await Ticket.create({ ...base, status: 'NEW', sla_resolve_due_at: future() })
    await Ticket.create({ ...base, status: 'NEW' }) // không có hạn SLA

    const res = await list(techToken, 'assignedToMe=true&slaBreached=true')

    expect(res.status).toBe(200)
    expect(res.body.meta.total).toBe(2)
    expect(res.body.data.map((t: { _id: string }) => t._id).sort())
      .toEqual([String(flaggedClosed._id), String(overdueOpen._id)].sort())
  })

  it('kết hợp được với lọc trạng thái', async () => {
    const { tech, farm, techToken } = await seed()
    const base = { farm_id: farm._id, type: 'OTHER', priority: 'P2', assigned_to: tech._id, sla_resolve_due_at: past() }
    await Ticket.create({ ...base, status: 'CLOSED', is_sla_breached: true })
    await Ticket.create({ ...base, status: 'IN_PROGRESS' })

    const res = await list(techToken, 'slaBreached=true&status=IN_PROGRESS')

    expect(res.body.meta.total).toBe(1)
    expect(res.body.data[0].status).toBe('IN_PROGRESS')
  })
})

describe('GET /tickets?search=', () => {
  it('tìm trong ghi chú (không phân biệt hoa thường) và theo tên farm', async () => {
    const { tech, farm, farmB, techToken } = await seed()
    const base = { type: 'OTHER', priority: 'P3', assigned_to: tech._id }
    const byNote = await Ticket.create({
      ...base, farm_id: farmB._id, notes: [{ content: 'Cảm biến CO2 tầng 2 báo sai' }],
    })
    const byFarm = await Ticket.create({ ...base, farm_id: farm._id, notes: [{ content: 'Loa không kêu' }] })
    await Ticket.create({ ...base, farm_id: farmB._id, notes: [{ content: 'Relay phun sương kẹt' }] })

    const note = await list(techToken, `search=${encodeURIComponent('co2')}`)
    expect(note.body.data.map((t: { _id: string }) => t._id)).toEqual([String(byNote._id)])

    const farmName = await list(techToken, `search=${encodeURIComponent('cần giờ')}`)
    expect(farmName.body.data.map((t: { _id: string }) => t._id)).toEqual([String(byFarm._id)])
  })

  it('coi ký tự đặc biệt là chữ thường, không phải mẫu regex', async () => {
    const { tech, farm, techToken } = await seed()
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', assigned_to: tech._id, notes: [{ content: 'abc' }] })

    const wildcard = await list(techToken, `search=${encodeURIComponent('.*')}`)
    expect(wildcard.status).toBe(200)
    expect(wildcard.body.meta.total).toBe(0)

    const broken = await list(techToken, `search=${encodeURIComponent('(a+')}`)
    expect(broken.status).toBe(200)
  })

  it('không trả ticket của farm ngoài vùng dù tên farm khớp', async () => {
    const { otherTech, farmHN, techToken } = await seed()
    await Ticket.create({ farm_id: farmHN._id, type: 'OTHER', priority: 'P3', assigned_to: otherTech._id })

    const res = await list(techToken, `search=${encodeURIComponent('Hà Nội')}`)

    expect(res.status).toBe(200)
    expect(res.body.meta.total).toBe(0)
  })

  it('từ chối chuỗi tìm kiếm quá dài', async () => {
    const { techToken } = await seed()
    const res = await list(techToken, `search=${'a'.repeat(101)}`)
    expect(res.status).toBe(422)
  })
})

describe('GET /tickets — lọc cũ vẫn chạy', () => {
  it('farmId + assignedToMe chỉ trả ticket của farm đó được giao cho mình', async () => {
    const { tech, otherTech, farm, farmB, techToken } = await seed()
    const mine = await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', assigned_to: tech._id })
    await Ticket.create({ farm_id: farmB._id, type: 'OTHER', priority: 'P3', assigned_to: tech._id })
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', assigned_to: otherTech._id })

    const res = await list(techToken, `farmId=${farm._id}&assignedToMe=true`)

    expect(res.status).toBe(200)
    expect(res.body.data.map((t: { _id: string }) => t._id)).toEqual([String(mine._id)])
  })
})

describe('GET /tickets/stats/me', () => {
  it('đếm trên toàn bộ ticket được giao, kể cả khi vượt xa một trang', async () => {
    const { tech, otherTech, farm, techToken } = await seed()
    const base = { farm_id: farm._id, type: 'OTHER', priority: 'P3' }
    await Ticket.insertMany([
      ...Array.from({ length: 60 }, () => ({ ...base, assigned_to: tech._id, status: 'NEW' })),
      ...Array.from({ length: 3 }, () => ({ ...base, assigned_to: tech._id, status: 'IN_PROGRESS', sla_resolve_due_at: past() })),
      { ...base, assigned_to: tech._id, status: 'AWAITING_FIELD_CONFIRMATION' },
      { ...base, assigned_to: tech._id, status: 'CLOSED', is_sla_breached: true },
      { ...base, assigned_to: tech._id, status: 'CLOSED' },
      { ...base, assigned_to: otherTech._id, status: 'NEW' }, // của người khác
    ])

    const res = await request(app).get('/tickets/stats/me').set('Authorization', `Bearer ${techToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      total: 66,
      open: 64,
      by_status: { NEW: 60, IN_PROGRESS: 3, AWAITING_FIELD_CONFIRMATION: 1, CLOSED: 2 },
      sla_breached: 4,
      sla_breached_open: 3,
    })
  })

  it('khớp với số ticket của GET /tickets?assignedToMe=true', async () => {
    const { tech, farm, techToken } = await seed()
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', assigned_to: tech._id })
    await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', assigned_to: tech._id, status: 'CLOSED' })

    const [stats, listed] = await Promise.all([
      request(app).get('/tickets/stats/me').set('Authorization', `Bearer ${techToken}`),
      list(techToken, 'assignedToMe=true'),
    ])

    expect(stats.body.data.total).toBe(listed.body.meta.total)
  })

  it('chỉ dành cho Technician', async () => {
    const { ownerToken } = await seed()
    const res = await request(app).get('/tickets/stats/me').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(403)
  })
})
