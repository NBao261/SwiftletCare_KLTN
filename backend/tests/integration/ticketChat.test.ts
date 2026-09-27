/**
 * Chat trong ticket — TICKET-FR-014..017, Flow 23.
 * Trọng tâm: ai được đọc/gửi, kênh chỉ đọc khi ticket đóng, dedupe khi gửi lại,
 * Technician cũ mất quyền gửi ngay sau khi bị chuyển ticket.
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
import { TicketMessage } from '@/models/ticketMessage.model'
import { User } from '@/models/user.model'
import { initSocket } from '@/socket'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

// socket.io giả — ghi lại handler 'connection' và các lệnh emit theo room
const mockHandlers: { connection?: (socket: unknown) => void } = {}
const mockEmits: Array<{ room: string; event: string; data: unknown }> = []
// Ghi lại io.in(<room nguồn>).socketsLeave(<room rời>) — cách người cũ bị đá khỏi kênh chat
const mockLeaves: Array<{ from: string; left: string }> = []
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    use: () => undefined,
    on: (event: string, fn: never) => { if (event === 'connection') mockHandlers.connection = fn },
    to: (room: string) => ({ emit: (event: string, data: unknown) => mockEmits.push({ room, event, data }) }),
    in: (from: string) => ({
      disconnectSockets: jest.fn(),
      socketsLeave: (left: string) => mockLeaves.push({ from, left }),
    }),
  })),
}))

const app = express()
app.use(express.json())
app.use('/tickets', ticketRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await TicketMessage.init() // tạo unique index dedupe trước khi test
  initSocket({} as never)
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  mockEmits.length = 0
  mockLeaves.length = 0
  await Promise.all([
    AuditLog.deleteMany({}), Farm.deleteMany({}), Ticket.deleteMany({}), TicketMessage.deleteMany({}), User.deleteMany({}),
  ])
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function seed() {
  const mk = (email: string, role: Role, extra: object = {}) =>
    User.create({ email, password_hash: 'password123', full_name: email.split('@')[0], role, ...extra })
  const owner = await mk('owner@test.vn', 'FARM_OWNER')
  const stranger = await mk('stranger@test.vn', 'FARM_OWNER')
  const admin = await mk('admin@test.vn', 'ADMIN')
  const tech = await mk('tech@test.vn', 'TECHNICIAN', { assigned_regions: ['HCMC'] })
  const other = await mk('other@test.vn', 'TECHNICIAN', { assigned_regions: ['HCMC'] })
  const farm = await Farm.create({ name: 'Farm', address: 'x', region: 'HCMC', owner_id: owner._id })
  const ticket = await Ticket.create({ farm_id: farm._id, type: 'OTHER', priority: 'P3', status: 'IN_PROGRESS', assigned_to: tech._id })
  return {
    ticket, owner, tech, other, admin,
    t: {
      owner: tokenFor(owner._id, 'FARM_OWNER'), stranger: tokenFor(stranger._id, 'FARM_OWNER'),
      admin: tokenFor(admin._id, 'ADMIN'), tech: tokenFor(tech._id, 'TECHNICIAN'), other: tokenFor(other._id, 'TECHNICIAN'),
    },
  }
}

const send = (ticketId: unknown, token: string, body: object) =>
  request(app).post(`/tickets/${ticketId}/messages`).set('Authorization', `Bearer ${token}`).send(body)
const history = (ticketId: unknown, token: string, qs = '') =>
  request(app).get(`/tickets/${ticketId}/messages${qs}`).set('Authorization', `Bearer ${token}`)

describe('REST /tickets/:id/messages', () => {
  it('Farm Owner và Technician phụ trách trò chuyện được, lịch sử theo thứ tự cũ → mới', async () => {
    const { ticket, t } = await seed()
    await send(ticket._id, t.owner, { content: 'Cảm biến báo lỗi liên tục' }).expect(201)
    const reply = await send(ticket._id, t.tech, { content: 'Tôi đang kiểm tra từ xa' }).expect(201)
    expect(reply.body.data).toMatchObject({ role: 'TECHNICIAN', author_name: 'tech', is_system: false })

    const res = await history(ticket._id, t.admin).expect(200)
    expect(res.body.data.map((m: { content: string }) => m.content)).toEqual(['Cảm biến báo lỗi liên tục', 'Tôi đang kiểm tra từ xa'])
    expect(res.body.meta.total).toBe(2)
    expect(mockEmits.filter(e => e.event === 'TICKET_MESSAGE_NEW' && e.room === `ticket:${ticket._id}`)).toHaveLength(2)
    expect((await Ticket.findById(ticket._id))!.last_message_at).toBeInstanceOf(Date)
  })

  it('phân trang: trang 1 là tin mới nhất', async () => {
    const { ticket, t } = await seed()
    for (const c of ['1', '2', '3']) await send(ticket._id, t.owner, { content: c }).expect(201)
    const page1 = await history(ticket._id, t.owner, '?limit=2').expect(200)
    const page2 = await history(ticket._id, t.owner, '?limit=2&page=2').expect(200)
    expect(page1.body.data.map((m: { content: string }) => m.content)).toEqual(['2', '3'])
    expect(page2.body.data.map((m: { content: string }) => m.content)).toEqual(['1'])
  })

  it('Technician khác cùng vùng và Farm Owner khác không đọc/gửi được (Flow 23 case 6a)', async () => {
    const { ticket, t } = await seed()
    await history(ticket._id, t.other).expect(403)
    await history(ticket._id, t.stranger).expect(403)
    await send(ticket._id, t.other, { content: 'x' }).expect(403)
  })

  it('ticket đóng thì chỉ đọc (TICKET-FR-016)', async () => {
    const { ticket, t } = await seed()
    await send(ticket._id, t.owner, { content: 'trước khi đóng' }).expect(201)
    await Ticket.updateOne({ _id: ticket._id }, { status: 'CLOSED' })
    await send(ticket._id, t.owner, { content: 'sau khi đóng' }).expect(409)
    expect((await history(ticket._id, t.owner).expect(200)).body.data).toHaveLength(1)
  })

  it('gửi lại cùng client_message_id không lưu trùng (Flow 23 case 5a)', async () => {
    const { ticket, t } = await seed()
    const first = await send(ticket._id, t.owner, { content: 'hello', client_message_id: 'c-1' }).expect(201)
    const retry = await send(ticket._id, t.owner, { content: 'hello', client_message_id: 'c-1' }).expect(201)
    expect(retry.body.data._id).toBe(first.body.data._id)
    expect(await TicketMessage.countDocuments()).toBe(1)
  })

  it('cùng client_message_id ở ticket khác vẫn được lưu (client đánh số theo từng cuộc trò chuyện)', async () => {
    const { ticket, owner, t } = await seed()
    const second = await Ticket.create({
      farm_id: ticket.farm_id, type: 'OTHER', priority: 'P3', status: 'IN_PROGRESS', created_by: owner._id,
    })
    await send(ticket._id, t.owner, { content: 'tin 1 của ticket A', client_message_id: 'm-1' }).expect(201)
    const other = await send(second._id, t.owner, { content: 'tin 1 của ticket B', client_message_id: 'm-1' }).expect(201)

    expect(other.body.data.content).toBe('tin 1 của ticket B')
    expect(await TicketMessage.countDocuments()).toBe(2)
  })
})

describe('đổi Technician phụ trách (TICKET-FR-017)', () => {
  it('tin hệ thống + người cũ chỉ còn đọc, người mới đọc được toàn bộ lịch sử', async () => {
    const { ticket, t, other } = await seed()
    await send(ticket._id, t.tech, { content: 'Tin của người cũ' }).expect(201)

    await request(app).put(`/tickets/${ticket._id}/admin-override`).set('Authorization', `Bearer ${t.admin}`)
      .send({ assigned_to: String(other._id), reason: 'Điều phối lại' }).expect(200)

    const res = await history(ticket._id, t.other).expect(200)
    expect(res.body.data.map((m: { content: string }) => m.content)).toEqual(['Tin của người cũ', 'Đã chuyển xử lý sang other'])
    expect(res.body.data[1]).toMatchObject({ role: 'SYSTEM', is_system: true, author_id: null })
    expect(mockEmits.some(e => e.event === 'TICKET_CHAT_ASSIGNEE_CHANGED')).toBe(true)

    const blocked = await send(ticket._id, t.tech, { content: 'còn gửi được không?' }).expect(403)
    expect(blocked.body.error.message).toContain('chuyển cho Technician khác')
    await send(ticket._id, t.other, { content: 'Tôi tiếp nhận' }).expect(201)

    // Người cũ chỉ còn thấy lịch sử tới tin bàn giao, không thấy trao đổi sau đó
    const oldView = await history(ticket._id, t.tech).expect(200)
    expect(oldView.body.data.map((m: { content: string }) => m.content))
      .toEqual(['Tin của người cũ', 'Đã chuyển xử lý sang other'])
    expect(oldView.body.meta.total).toBe(2)
    const newView = await history(ticket._id, t.other).expect(200)
    expect(newView.body.data).toHaveLength(3)
  })
})

describe('Socket JOIN_TICKET_CHAT / SEND_TICKET_MESSAGE', () => {
  function fakeSocket(userId: unknown) {
    const handlers: Record<string, (...args: unknown[]) => void> = {}
    const socket = {
      id: 's1', data: { userId: String(userId) },
      join: jest.fn().mockResolvedValue(undefined), leave: jest.fn(),
      on: (event: string, fn: never) => { handlers[event] = fn },
    }
    mockHandlers.connection!(socket)
    const call = (event: string, data: object) =>
      new Promise<{ ok: boolean; data?: { content: string }; error?: string }>(resolve => handlers[event](data, resolve))
    return { socket, call }
  }

  it('người được phép join room ticket:{id} và gửi tin qua ack', async () => {
    const { ticket, owner } = await seed()
    const { socket, call } = fakeSocket(owner._id)

    expect(await call('JOIN_TICKET_CHAT', { ticketId: String(ticket._id) })).toEqual({ ok: true })
    expect(socket.join).toHaveBeenCalledWith(`ticket:${ticket._id}`)

    const sent = await call('SEND_TICKET_MESSAGE', { ticketId: String(ticket._id), content: 'qua socket', clientMessageId: 'x1' })
    expect(sent.ok).toBe(true)
    expect(sent.data!.content).toBe('qua socket')
  })

  it('người không liên quan bị từ chối join, không vào room', async () => {
    const { ticket, other } = await seed()
    const { socket, call } = fakeSocket(other._id)
    const res = await call('JOIN_TICKET_CHAT', { ticketId: String(ticket._id) })
    expect(res.ok).toBe(false)
    expect(socket.join).not.toHaveBeenCalledWith(`ticket:${ticket._id}`)
  })

  it('Technician cũ không join lại được room (chỉ đọc lịch sử qua REST)', async () => {
    const { ticket, tech, other, t } = await seed()
    const { socket, call } = fakeSocket(tech._id)
    expect(await call('JOIN_TICKET_CHAT', { ticketId: String(ticket._id) })).toEqual({ ok: true })

    await request(app).put(`/tickets/${ticket._id}/admin-override`).set('Authorization', `Bearer ${t.admin}`)
      .send({ assigned_to: String(other._id), reason: 'Điều phối lại' }).expect(200)

    const res = await call('JOIN_TICKET_CHAT', { ticketId: String(ticket._id) })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('xem lại được lịch sử cũ')
    // Lúc reassign, server đã đá mọi socket của người cũ khỏi room chat
    expect(mockLeaves).toContainEqual({ from: `user:${tech._id}`, left: `ticket:${ticket._id}` })
    // Chỉ join room chat đúng 1 lần (lần đầu), lần sau bị từ chối
    expect(socket.join.mock.calls.filter(c => c[0] === `ticket:${ticket._id}`)).toHaveLength(1)
  })

  it('phân trang theo cursor `before` không lặp tin khi có tin mới chen vào', async () => {
    const { ticket, t } = await seed()
    for (const c of ['1', '2', '3']) await send(ticket._id, t.owner, { content: c }).expect(201)

    const page1 = await history(ticket._id, t.owner, '?limit=2').expect(200)
    expect(page1.body.data.map((m: { content: string }) => m.content)).toEqual(['2', '3'])

    // Tin mới chen vào giữa 2 lần tải — phân trang offset sẽ trả lại '2'
    await send(ticket._id, t.tech, { content: '4' }).expect(201)

    const oldest = page1.body.data[0].created_at as string
    const older = await history(ticket._id, t.owner, `?limit=2&before=${encodeURIComponent(oldest)}`).expect(200)
    expect(older.body.data.map((m: { content: string }) => m.content)).toEqual(['1'])
  })
})
