/**
 * Route-level tests cho /admin — validation, phân quyền, ép kiểu boolean.
 * Mount riêng router trên 1 Express app nhỏ (không khởi động MQTT/Socket của server thật).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import adminRoutes from '@/routes/admin.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { User } from '@/models/user.model'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/admin', adminRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

async function makeUser(email: string, role: Role) {
  const user = await User.create({ email, password_hash: 'password123', full_name: email, role })
  return { user, token: tokenFor(user._id, role) }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await User.deleteMany({})
})

describe('access control', () => {
  it('rejects requests without a token (401)', async () => {
    await request(app).get('/admin/users').expect(401)
  })

  it('rejects non-admin roles (403)', async () => {
    const { token } = await makeUser('owner@test.vn', 'FARM_OWNER')
    await request(app).get('/admin/users').set('Authorization', `Bearer ${token}`).expect(403)
  })
})

describe('GET /admin/users — query validation & pagination', () => {
  it.each([
    ['page=0', 'page=0'],
    ['page=-1', 'page=-1'],
    ['limit=abc', 'limit=abc'],
    ['limit=0', 'limit=0'],
    ['unknown role', 'role=HACKER'],
    ['unknown status', 'status=maybe'],
  ])('returns 422 for %s', async (_label, qs) => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    await request(app).get(`/admin/users?${qs}`).set('Authorization', `Bearer ${token}`).expect(422)
  })

  it('clamps an oversized limit to 100 and reports the real meta', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const res = await request(app).get('/admin/users?limit=1000').set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.meta).toMatchObject({ page: 1, limit: 100, total: 1 })
  })

  it('filters by role and status', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    await makeUser('tech@test.vn', 'TECHNICIAN')
    const res = await request(app)
      .get('/admin/users?role=TECHNICIAN&status=active')
      .set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].email).toBe('tech@test.vn')
  })
})

describe('GET /admin/delete-requests — query validation', () => {
  it('returns 422 for a non-numeric limit', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    await request(app).get('/admin/delete-requests?limit=abc').set('Authorization', `Bearer ${token}`).expect(422)
  })
})

describe('PUT /admin/users/:id/status — boolean coercion', () => {
  it('treats the string "false" as false, so the lock reason is still required', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user: target } = await makeUser('victim@test.vn', 'FARM_OWNER')

    await request(app)
      .put(`/admin/users/${target._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: 'false' })
      .expect(400)

    expect((await User.findById(target._id))!.is_active).toBe(true)
  })

  it('locks the account with reason and timestamp when is_active is the string "0"', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user: target } = await makeUser('victim@test.vn', 'FARM_OWNER')

    await request(app)
      .put(`/admin/users/${target._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: '0', reason: 'Spam đơn hàng' })
      .expect(200)

    const locked = (await User.findById(target._id))!
    expect(locked.is_active).toBe(false)
    expect(locked.deactivated_reason).toBe('Spam đơn hàng')
    expect(locked.deactivated_at).toBeInstanceOf(Date)
  })

  it('rejects a non-boolean is_active', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user: target } = await makeUser('victim@test.vn', 'FARM_OWNER')
    await request(app)
      .put(`/admin/users/${target._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: 'maybe' })
      .expect(422)
  })

  it('blocks an admin from locking their own account', async () => {
    const { user: admin, token } = await makeUser('admin@test.vn', 'ADMIN')
    await request(app)
      .put(`/admin/users/${admin._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false, reason: 'test' })
      .expect(400)
  })
})

describe('POST /admin/technicians — assigned_regions validation', () => {
  const base = { email: 'new-tech@test.vn', password: 'password123', full_name: 'Tech' }

  it('rejects blank region entries', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    await request(app)
      .post('/admin/technicians').set('Authorization', `Bearer ${token}`)
      .send({ ...base, assigned_regions: ['HCMC', '  '] })
      .expect(422)
  })

  it('creates the technician with valid regions', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const res = await request(app)
      .post('/admin/technicians').set('Authorization', `Bearer ${token}`)
      .send({ ...base, assigned_regions: ['HCMC', 'Long An'] })
      .expect(201)
    expect(res.body.data.assigned_regions).toEqual(['HCMC', 'Long An'])
  })
})
