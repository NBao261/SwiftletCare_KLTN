/**
 * SEC-NFR-004 — rate limit tách 3 suất: API đếm theo tài khoản, đăng nhập/OTP đếm
 * theo IP, refresh có suất riêng. Không cần DB: mount limiter lên app Express nhỏ.
 */
import express, { type RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'

// Limiter đọc env lúc nạp module — đặt giới hạn nhỏ TRƯỚC khi require
process.env.JWT_ACCESS_SECRET = 'test-access-secret'
process.env.RATE_LIMIT_MAX = '3'
process.env.AUTH_RATE_LIMIT_MAX = '2'
process.env.REFRESH_RATE_LIMIT_MAX = '5'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const limiters = require('@/middlewares/rateLimiter.middleware') as Record<
  'apiLimiter' | 'loginLimiter' | 'passwordResetLimiter' | 'refreshLimiter', RequestHandler
>

const ok: RequestHandler = (_req, res) => { res.json({ success: true }) }

const app = express()
app.use(express.json())
app.use(limiters.apiLimiter)
app.get('/health', ok)
app.get('/data', ok)
app.post('/auth/refresh', limiters.refreshLimiter, ok)
app.post('/auth/login', limiters.loginLimiter, (req, res) => {
  res.status(req.body.password === 'right' ? 200 : 401).json({ success: req.body.password === 'right' })
})
app.post('/auth/forgot-password', limiters.passwordResetLimiter, ok)

const bearer = (sub: string) => `Bearer ${jwt.sign({ sub, role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!)}`

describe('apiLimiter — đếm theo tài khoản', () => {
  it('blocks only the account that used up its quota, with the standard error envelope', async () => {
    for (let i = 0; i < 3; i++) await request(app).get('/data').set('Authorization', bearer('user-a')).expect(200)

    const blocked = await request(app).get('/data').set('Authorization', bearer('user-a')).expect(429)
    expect(blocked.body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } })
    expect(blocked.body.error.details.retryAfterSec).toBeGreaterThan(0)
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)

    // Cùng IP nhưng tài khoản khác — không bị chặn lây
    await request(app).get('/data').set('Authorization', bearer('user-b')).expect(200)
  })

  it('still lets an account that ran out of API quota refresh its token', async () => {
    for (let i = 0; i < 3; i++) await request(app).get('/data').set('Authorization', bearer('user-c'))
    await request(app).get('/data').set('Authorization', bearer('user-c')).expect(429)

    await request(app).post('/auth/refresh').set('Authorization', bearer('user-c')).expect(200)
  })

  it('never limits /health and sends the X-RateLimit headers on counted requests', async () => {
    for (let i = 0; i < 5; i++) await request(app).get('/health').set('Authorization', bearer('user-d')).expect(200)

    const res = await request(app).get('/data').set('Authorization', bearer('user-d')).expect(200)
    expect(res.headers['x-ratelimit-limit']).toBe('3')
    expect(res.headers['x-ratelimit-remaining']).toBe('2')
  })
})

describe('đăng nhập / OTP — đếm theo IP', () => {
  it('counts only failed logins', async () => {
    for (let i = 0; i < 3; i++) await request(app).post('/auth/login').send({ password: 'right' }).expect(200)

    await request(app).post('/auth/login').send({ password: 'wrong' }).expect(401)
    await request(app).post('/auth/login').send({ password: 'wrong' }).expect(401)
    const blocked = await request(app).post('/auth/login').send({ password: 'right' }).expect(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
  })

  it('counts every password-reset e-mail, successful or not', async () => {
    await request(app).post('/auth/forgot-password').expect(200)
    await request(app).post('/auth/forgot-password').expect(200)
    await request(app).post('/auth/forgot-password').expect(429)
  })
})
