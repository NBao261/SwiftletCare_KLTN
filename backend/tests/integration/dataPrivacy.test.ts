/**
 * Dữ liệu cá nhân không lọt ra ngoài người được xem: xoá tài khoản xoá cả liên kết Telegram,
 * Domain Expert không thấy danh sách thành viên, lịch sử can thiệp tay không trả email.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import deviceRoutes from '@/routes/devices.route'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Farm } from '@/models/farm.model'
import { User } from '@/models/user.model'
import { completeDeletionRequest } from '@/services/admin.service'
import { seedOwnerFarm as seed, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use('/farms', farmRoutes)
app.use(errorHandler)

useTestDb()

describe('xoá tài khoản (AUTH-FR-012, PRIV-NFR-003)', () => {
  it('xoá luôn chat id và mã liên kết Telegram', async () => {
    const admin = await User.create({ email: 'admin@test.vn', password_hash: 'password123', full_name: 'A', role: 'ADMIN' })
    const user = await User.create({
      email: 'gone@test.vn', password_hash: 'password123', full_name: 'Gone', role: 'DOMAIN_EXPERT',
      telegram_chat_id: '123456', telegram_link_code_hash: 'abc', telegram_link_expires_at: new Date(Date.now() + 60_000),
      deletion_requested_at: new Date(),
    })

    await completeDeletionRequest(String(admin._id), String(user._id))

    const after = (await User.findById(user._id).select('+telegram_link_code_hash +telegram_link_expires_at'))!
    expect(after.email).toContain('deleted-')
    expect(after.telegram_chat_id).toBeUndefined()
    expect(after.telegram_link_code_hash).toBeUndefined()
    expect(after.telegram_link_expires_at).toBeUndefined()
  })
})

describe('Domain Expert chỉ thấy chính mình trong danh sách thành viên (mục 4.4)', () => {
  it('GET /farms không lộ danh sách thành viên cho Domain Expert (như GET /farms/:id)', async () => {
    const { owner, farm } = await seed()
    const expert = await User.create({ email: 'ex@test.vn', password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
    await Farm.updateOne({ _id: farm._id }, { $push: { members: { user_id: expert._id, role: 'DOMAIN_EXPERT' } } })
    const as = (id: unknown, role: string) =>
      request(app).get('/farms').set('Authorization', `Bearer ${jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })}`)

    const forExpert = await as(expert._id, 'DOMAIN_EXPERT').expect(200)
    expect(forExpert.body.data).toHaveLength(1)
    expect(forExpert.body.data[0].members.map((m: { user_id: string }) => m.user_id)).toEqual([String(expert._id)])
    const forOwner = await as(owner._id, 'FARM_OWNER').expect(200)
    expect(forOwner.body.data[0].members).toHaveLength(2)
  })
})

describe('lịch sử can thiệp tay (ENV-FR-019)', () => {
  it('lịch sử can thiệp tay không trả email của người thao tác', async () => {
    const { relay, token } = await seed()
    await request(app).post(`${relay}/relay`).set('Authorization', `Bearer ${token}`).send({ relayName: 'misting', state: true }).expect(200)
    const res = await request(app).get(`${relay}/relay-overrides`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data[0].started_by).toMatchObject({ full_name: 'O' })
    expect(res.body.data[0].started_by).not.toHaveProperty('email')
  })
})
