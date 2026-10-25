/**
 * Route-level tests cho /admin — validation, phân quyền, ép kiểu boolean.
 * Mount riêng router trên 1 Express app nhỏ (không khởi động MQTT/Socket của server thật).
 */
import { createHash } from 'crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import adminRoutes from '@/routes/admin.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { forgotPassword, resetPassword } from '@/services/auth.service'
import { Farm } from '@/models/farm.model'
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
  await Promise.all([User.deleteMany({}), Farm.deleteMany({})])
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

  it('lọc được tài khoản Domain Expert (role có trong users.role phải lọc được)', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    await User.create({ email: 'expert@test.vn', password_hash: 'password123', full_name: 'Expert', role: 'DOMAIN_EXPERT' })
    const res = await request(app)
      .get('/admin/users?role=DOMAIN_EXPERT')
      .set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual(['expert@test.vn'])
  })
})

describe('không để lọt mã dùng 1 lần qua API', () => {
  /**
   * Mã OTP và mã đặt lại mật khẩu đều là 6 chữ số hash SHA-256 không salt — dò
   * hết 900.000 khả năng mất dưới 1 giây, nên hash lọt ra ngoài là coi như mã
   * lọt ra ngoài: ai đọc được response này đổi được mật khẩu của user đó.
   */
  const secretKeys = ['password_hash', 'otp_code', 'otp_expires', 'refresh_tokens',
    'password_reset_token_hash', 'password_reset_expires_at']

  it('GET /admin/users không trả field bí mật nào, kể cả khi user đang trong 15 phút đặt lại mật khẩu', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user: target } = await makeUser('victim@test.vn', 'FARM_OWNER')
    await User.updateOne({ _id: target._id }, {
      password_reset_token_hash: createHash('sha256').update('483912').digest('hex'),
      password_reset_expires_at: new Date(Date.now() + 900_000),
      otp_code: createHash('sha256').update('112233').digest('hex'),
    })

    const res = await request(app).get('/admin/users').set('Authorization', `Bearer ${token}`).expect(200)

    const victim = (res.body.data as Array<Record<string, unknown>>).find(u => u.email === 'victim@test.vn')!
    expect(victim.full_name).toBe('victim@test.vn') // vẫn trả dữ liệu bình thường
    for (const key of secretKeys) expect(victim).not.toHaveProperty(key)
  })

  it('PUT /admin/users/:id/status cũng không trả field bí mật nào', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user: target } = await makeUser('victim@test.vn', 'FARM_OWNER')
    await User.updateOne({ _id: target._id }, {
      password_reset_token_hash: createHash('sha256').update('483912').digest('hex'),
      password_reset_expires_at: new Date(Date.now() + 900_000),
    })

    const res = await request(app)
      .put(`/admin/users/${target._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false, reason: 'Spam' })
      .expect(200)

    for (const key of secretKeys) expect(res.body.data).not.toHaveProperty(key)
  })

  it('luồng đặt lại mật khẩu vẫn đọc được hash dù field đã select:false', async () => {
    await makeUser('reset@test.vn', 'FARM_OWNER')
    await forgotPassword('reset@test.vn')

    const stored = await User.findOne({ email: 'reset@test.vn' })
      .select('+password_reset_token_hash').lean()
    expect(stored!.password_reset_token_hash).toBeTruthy()
    await expect(resetPassword('reset@test.vn', '000000', 'newpassword1')).rejects.toThrow()
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

describe('PUT /admin/users/:id/status — response', () => {
  it('returns the locked user without meta', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user: tech } = await makeUser('tech@test.vn', 'TECHNICIAN')
    const res = await request(app)
      .put(`/admin/users/${tech._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false, reason: 'Spam' })
      .expect(200)
    expect(res.body.meta).toBeUndefined()
  })
})

describe('PUT /admin/delete-requests/:id/reject', () => {
  it('returns 422 without a reason and leaves the request pending', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user } = await makeUser('user@test.vn', 'FARM_OWNER')
    user.deletion_requested_at = new Date()
    await user.save()

    await request(app).put(`/admin/delete-requests/${user._id}/reject`).set('Authorization', `Bearer ${token}`)
      .send({ reason: '  ' }).expect(422)
    expect((await User.findById(user._id))!.deletion_requested_at).toBeInstanceOf(Date)
  })

  it('takes the request off GET /admin/delete-requests', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user } = await makeUser('user@test.vn', 'FARM_OWNER')
    user.deletion_requested_at = new Date()
    await user.save()

    await request(app).put(`/admin/delete-requests/${user._id}/reject`).set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Còn hồ sơ phải lưu' }).expect(200)

    const res = await request(app).get('/admin/delete-requests').set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data).toHaveLength(0)
  })
})

describe('POST /admin/technicians — phone', () => {
  const base = { email: 'newtech@test.vn', password: 'password123', full_name: 'Tech mới' }

  it.each(['12345', '09123456789', 'abc0912345678'])('returns 422 for phone %p', async phone => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    await request(app).post('/admin/technicians').set('Authorization', `Bearer ${token}`)
      .send({ ...base, phone }).expect(422)
    expect(await User.countDocuments({ email: base.email })).toBe(0)
  })

  it('accepts a phone with separators or +84 and stores it without them', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const res = await request(app).post('/admin/technicians').set('Authorization', `Bearer ${token}`)
      .send({ ...base, phone: '+84 912.345-678' }).expect(201)
    expect(res.body.data.phone).toBe('+84912345678')
  })

  it('works without a phone and stores no region (Technician works on every farm, FARM-FR-009)', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const res = await request(app).post('/admin/technicians').set('Authorization', `Bearer ${token}`)
      .send({ ...base, phone: '', assigned_regions: ['HCMC'] }).expect(201)
    expect(res.body.data.phone).toBeUndefined()
    expect(res.body.data.assigned_regions).toBeUndefined()
  })
})

describe('PUT /admin/delete-requests/:id/complete', () => {
  it('completes a technician deletion without any extra flag', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user: tech } = await makeUser('tech@test.vn', 'TECHNICIAN')
    tech.deletion_requested_at = new Date()
    await tech.save()
    await request(app)
      .put(`/admin/delete-requests/${tech._id}/complete`).set('Authorization', `Bearer ${token}`).send({})
      .expect(200)
    expect((await User.findById(tech._id))!.is_active).toBe(false)
  })
})

describe('PUT /admin/technicians/:id/regions', () => {
  it('is gone (Report 3 §8: no Technician regions)', async () => {
    const { token } = await makeUser('admin@test.vn', 'ADMIN')
    const { user: tech } = await makeUser('tech@test.vn', 'TECHNICIAN')
    await request(app).put(`/admin/technicians/${tech._id}/regions`).set('Authorization', `Bearer ${token}`)
      .send({ assigned_regions: ['HCMC'] }).expect(404)
  })
})
