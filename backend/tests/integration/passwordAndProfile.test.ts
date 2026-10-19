/**
 * AUTH-FR-005c — mật khẩu tạm của Technician (bắt đổi trước khi dùng), PUT /auth/password,
 * Admin sửa hồ sơ và cấp lại mật khẩu tạm cho Technician.
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
import { createTechnician, resetTechnicianPassword, updateTechnicianProfile } from '@/services/admin.service'
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
  it('a technician created by an admin must change the password before using anything else', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const temporary = freshPassword()
    const chosen = freshPassword()
    const tech = await createTechnician(String(admin._id), {
      email: 'tech@test.vn', password: temporary, full_name: 'Tech', assigned_regions: ['HCMC'],
    })
    expect(tech.must_change_password).toBe(true)
    const token = tokenFor(tech._id, 'TECHNICIAN')

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
    const user = await mkUser('temp@test.vn', 'TECHNICIAN', { must_change_password: true })
    await request(app).post('/auth/logout').set('Authorization', `Bearer ${tokenFor(user._id, 'TECHNICIAN')}`).expect(200)
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

describe('Admin quản lý Technician', () => {
  it('issues a one-time temporary password that works and must be changed, and drops every session', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const tech = await mkUser('tech@test.vn', 'TECHNICIAN', {
      assigned_regions: ['HCMC'], refresh_tokens: [{ token_hash: 'x', expires: new Date(Date.now() + 1e6) }],
    })

    const res = await request(app).put(`/admin/technicians/${tech._id}/password`)
      .set('Authorization', `Bearer ${tokenFor(admin._id, 'ADMIN')}`).expect(200)

    const temporary = res.body.data.temporary_password as string
    expect(temporary).toHaveLength(12)
    const after = (await User.findById(tech._id))!
    expect(await after.comparePassword(temporary)).toBe(true)
    expect(after.must_change_password).toBe(true)
    expect(after.refresh_tokens).toHaveLength(0)
    expect(await AuditLog.countDocuments({ action: 'TECHNICIAN_PASSWORD_RESET' })).toBe(1)
  })

  it('updates the name and phone, clears the phone with an empty string, and audits before/after', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const tech = await mkUser('tech@test.vn', 'TECHNICIAN', { phone: '0900000000' })

    const updated = await updateTechnicianProfile(String(admin._id), String(tech._id), { full_name: 'Tên mới', phone: '' })

    expect(updated.full_name).toBe('Tên mới')
    expect(updated.phone).toBeUndefined()
    const [audit] = await AuditLog.find({ action: 'TECHNICIAN_PROFILE_UPDATED' }).lean()
    expect(audit.metadata).toMatchObject({ before: { full_name: 'tech@test.vn', phone: '0900000000' }, after: { phone: null } })
  })

  it('validates the phone at the route and refuses non-technicians and deleted accounts', async () => {
    const admin = await mkUser('admin@test.vn', 'ADMIN')
    const tech = await mkUser('tech@test.vn', 'TECHNICIAN')
    const owner = await mkUser('owner@test.vn', 'FARM_OWNER')
    const deleted = await mkUser('gone@test.vn', 'TECHNICIAN', { deleted_at: new Date(), is_active: false })

    await request(app).put(`/admin/technicians/${tech._id}/profile`)
      .set('Authorization', `Bearer ${tokenFor(admin._id, 'ADMIN')}`).send({ phone: '12345' }).expect(422)
    await expect(updateTechnicianProfile(String(admin._id), String(owner._id), { full_name: 'x' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(updateTechnicianProfile(String(admin._id), String(tech._id), {})).rejects.toMatchObject({ statusCode: 400 })
    await expect(resetTechnicianPassword(String(admin._id), String(deleted._id))).rejects.toMatchObject({ statusCode: 409 })
  })
})
