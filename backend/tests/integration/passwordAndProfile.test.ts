/**
 * Mật khẩu tạm (bắt đổi trước khi dùng), PUT /auth/password. Admin không còn tạo hay cấp mật khẩu
 * cho Technician (G-20: Farm Technician vào farm qua lời mời của Farm Owner, AUTH-FR-005, 010).
 */
import { randomBytes } from 'crypto'
import express, { type RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import adminRoutes from '@/routes/admin.route'
import authRoutes from '@/routes/auth.route'
import { authenticate } from '@/middlewares/auth.middleware'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { User } from '@/models/user.model'
import { loginUser } from '@/services/auth.service'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

jest.mock('@/socket', () => ({ ...jest.requireActual('@/socket'), disconnectUser: jest.fn() }))

const ok: RequestHandler = (_req, res) => { res.json({ success: true }) }
const app = express()
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/admin', adminRoutes)
app.get('/protected', authenticate, ok)
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
  await Promise.all([AuditLog.deleteMany({}), User.deleteMany({})])
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const mkUser = (email: string, role: Role, extra: object = {}) =>
  User.create({ email, password_hash: 'password123', full_name: email, role, ...extra })
// Sinh lúc chạy thay vì viết thẳng chuỗi: máy quét secret (GitGuardian) coi `password: '...'` là lộ mật khẩu
const freshPassword = () => randomBytes(9).toString('base64url')

describe('mật khẩu tạm (must_change_password)', () => {
  it('a user with a temporary password must change it before using anything else', async () => {
    const temporary = freshPassword()
    const chosen = freshPassword()
    const tech = await User.create({
      email: 'tech@test.vn', password_hash: temporary, full_name: 'Tech', role: 'FARM_TECHNICIAN', must_change_password: true,
    })
    const token = tokenFor(tech._id, 'FARM_TECHNICIAN')

    const blocked = await request(app).get('/protected').set('Authorization', `Bearer ${token}`).expect(403)
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED')

    await request(app).put('/auth/password').set('Authorization', `Bearer ${token}`)
      .send({ current_password: temporary, new_password: chosen }).expect(200)

    await request(app).get('/protected').set('Authorization', `Bearer ${token}`).expect(200)
    const after = (await User.findById(tech._id))!
    expect(after.must_change_password).toBe(false)
    expect(await after.comparePassword(chosen)).toBe(true)
  })

  it('still lets a user with a temporary password log out', async () => {
    const user = await mkUser('temp@test.vn', 'FARM_TECHNICIAN', { must_change_password: true })
    await request(app).post('/auth/logout').set('Authorization', `Bearer ${tokenFor(user._id, 'FARM_TECHNICIAN')}`).expect(200)
  })
})

describe('PUT /auth/password', () => {
  it('keeps the current session and revokes every other one', async () => {
    await mkUser('owner@test.vn', 'FARM_OWNER')
    const phone = await loginUser({ email: 'owner@test.vn', password: 'password123' })
    const laptop = await loginUser({ email: 'owner@test.vn', password: 'password123' })

    await request(app).put('/auth/password').set('Authorization', `Bearer ${laptop.accessToken}`)
      .send({ current_password: 'password123', new_password: freshPassword(), refreshToken: laptop.refreshToken }).expect(200)

    await request(app).post('/auth/refresh').send({ refreshToken: laptop.refreshToken }).expect(200)
    await request(app).post('/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(401)
    expect(await AuditLog.countDocuments({ action: 'PASSWORD_CHANGED' })).toBe(1)
  })

  it('rejects a wrong current password (400, not 401) and an unchanged password', async () => {
    const user = await mkUser('owner@test.vn', 'FARM_OWNER')
    const token = tokenFor(user._id, 'FARM_OWNER')

    const wrong = await request(app).put('/auth/password').set('Authorization', `Bearer ${token}`)
      .send({ current_password: freshPassword(), new_password: freshPassword() }).expect(400)
    expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD')

    const same = await request(app).put('/auth/password').set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'password123', new_password: 'password123' }).expect(400)
    expect(same.body.error.code).toBe('PASSWORD_UNCHANGED')

    await request(app).put('/auth/password').set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'password123', new_password: freshPassword().slice(0, 5) }).expect(422)
  })
})

describe('Admin không còn quản lý Technician (G-20)', () => {
  it('has no technician account or temporary-password route', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const tech = await mkUser('tech@test.vn', 'FARM_TECHNICIAN')
    const auth = `Bearer ${tokenFor(admin._id, 'ADMIN')}`

    await request(app).post('/admin/technicians').set('Authorization', auth)
      .send({ email: 'new@test.vn', password: freshPassword(), full_name: 'x' }).expect(404)
    await request(app).put(`/admin/technicians/${tech._id}/password`).set('Authorization', auth).expect(404)
  })
})
