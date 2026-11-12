/**
 * ALERT-FR-002 (G-10) — push qua FCM: đăng ký và gỡ FCM device token, gửi cảnh báo tới mọi máy của
 * người nhận kèm dữ liệu để mở chi tiết cảnh báo, xoá token FCM báo hỏng, không ghi token ra log.
 * Firebase Admin SDK được giả lập — test không gọi mạng thật (TC-F08-03).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import notificationRoutes from '@/routes/notifications.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert, IAlert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { PushToken } from '@/models/pushToken.model'
import { User } from '@/models/user.model'
import { completeDeletionRequest } from '@/services/admin.service'
import { dispatchAlertNotification } from '@/services/notification.service'
import { resetPushForTests } from '@/services/push.service'
import logger from '@/utils/logger.util'
import type { AlertSeverity } from '@/types'

const mockSend = jest.fn()
jest.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: () => ({ name: 'test-app' }),
  cert: (serviceAccount: unknown) => serviceAccount,
}))
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEachForMulticast: (...args: unknown[]) => mockSend(...args) }),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/notifications', notificationRoutes)
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
beforeEach(() => {
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH = './config/firebase-service-account.json'
  resetPushForTests()
  mockSend.mockReset()
  mockSend.mockImplementation(async ({ tokens }: { tokens: string[] }) => ({
    successCount: tokens.length, failureCount: 0, responses: tokens.map(() => ({ success: true })),
  }))
})
afterEach(async () => {
  jest.restoreAllMocks()
  await Promise.all([Alert, Farm, PushToken, User].map(m => (m as typeof User).deleteMany({})))
})

let seq = 0
/** Không có giờ im lặng: kết quả không phụ thuộc giờ chạy test (giờ im lặng là ALERT-FR-006, có test riêng) */
const ALWAYS_ON = { push: true, telegram: false, quiet_hours: { start: '00:00', end: '00:00' } }
const mkUser = (over: Record<string, unknown> = {}) =>
  User.create({ email: `p${++seq}@test.vn`, password_hash: 'password123', full_name: 'P', role: 'FARM_OWNER', notification_preferences: ALWAYS_ON, ...over })
const bearer = (u: { _id: unknown }) => `Bearer ${jwt.sign({ sub: String(u._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })}`
const register = (u: { _id: unknown }, token: string, platform = 'android') =>
  request(app).post('/notifications/push-tokens').set('Authorization', bearer(u)).send({ token, platform })
const unregister = (u: { _id: unknown }, token: string) =>
  request(app).delete('/notifications/push-tokens').set('Authorization', bearer(u)).send({ token })
const tokensOf = async (u: { _id: unknown }) =>
  (await PushToken.find({ user_id: u._id }).select('+token').lean()).map(t => t.token).sort()

async function farmOf(owner: { _id: unknown }) {
  const farm = await Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }] })
  return (severity: AlertSeverity) =>
    new Alert({ farm_id: farm._id, type: 'SENSOR_FAULT', severity, title: 'Cảm biến lỗi', message: 'Mất tín hiệu SHT31' }) as IAlert
}

describe('đăng ký FCM device token', () => {
  it('stores the token of the caller, moves a token to a new account and refuses an Expo token', async () => {
    const first = await mkUser()
    const second = await mkUser()

    const res = await register(first, 'fcm-token-1').expect(200)
    expect(res.body.data).toEqual({ registered: true })
    expect(JSON.stringify(res.body)).not.toContain('fcm-token-1')
    await register(first, 'fcm-token-1').expect(200)   // gọi lại: không tạo bản ghi thứ 2
    expect(await tokensOf(first)).toEqual(['fcm-token-1'])

    // Cùng máy đăng nhập tài khoản khác: tài khoản cũ không nhận push trên máy này nữa
    await register(second, 'fcm-token-1', 'ios').expect(200)
    expect(await tokensOf(first)).toEqual([])
    expect(await tokensOf(second)).toEqual(['fcm-token-1'])

    await register(first, 'ExponentPushToken[abc]').expect(422)
    await register(first, 'fcm-token-2', 'windows').expect(422)
    await request(app).post('/notifications/push-tokens').send({ token: 'x', platform: 'android' }).expect(401)
  })

  it('removes only the caller\'s own token and is safe to repeat at sign-out', async () => {
    const owner = await mkUser()
    const other = await mkUser()
    await register(owner, 'fcm-owner').expect(200)

    await unregister(other, 'fcm-owner').expect(200)
    expect(await tokensOf(owner)).toEqual(['fcm-owner'])

    const res = await unregister(owner, 'fcm-owner').expect(200)
    expect(res.body.data).toEqual({ registered: false })
    await unregister(owner, 'fcm-owner').expect(200)
    expect(await tokensOf(owner)).toEqual([])
  })
})

describe('gửi cảnh báo qua FCM (TC-F08-03)', () => {
  it('pushes a CRITICAL alert with high priority and the alert to open; nothing after sign-out', async () => {
    const owner = await mkUser()
    const alert = await farmOf(owner)
    await register(owner, 'fcm-phone').expect(200)
    await register(owner, 'fcm-tablet', 'ios').expect(200)

    const critical = alert('CRITICAL')
    await dispatchAlertNotification(critical)

    expect(mockSend).toHaveBeenCalledTimes(1)
    const message = mockSend.mock.calls[0][0]
    expect([...message.tokens].sort()).toEqual(['fcm-phone', 'fcm-tablet'])
    expect(message.notification).toEqual({ title: 'Cảm biến lỗi', body: '[CRITICAL] Cảm biến lỗi — Mất tín hiệu SHT31' })
    expect(message.data).toEqual({ kind: 'alert', id: String(critical._id) })
    expect(message.android).toEqual({ priority: 'high' })
    expect(message.apns).toEqual({ headers: { 'apns-priority': '10' } })

    await unregister(owner, 'fcm-phone').expect(200)
    await unregister(owner, 'fcm-tablet').expect(200)
    mockSend.mockClear()
    await dispatchAlertNotification(alert('CRITICAL'))
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends a lower alert with normal priority', async () => {
    const owner = await mkUser()
    const alert = await farmOf(owner)
    await register(owner, 'fcm-phone').expect(200)

    await dispatchAlertNotification(alert('MEDIUM'))

    expect(mockSend.mock.calls[0][0].android).toEqual({ priority: 'normal' })
  })

  it('deletes a token FCM reports invalid and never writes a token to the log', async () => {
    const owner = await mkUser()
    const alert = await farmOf(owner)
    await register(owner, 'fcm-stale').expect(200)
    await register(owner, 'fcm-good').expect(200)
    mockSend.mockImplementation(async ({ tokens }: { tokens: string[] }) => ({
      successCount: 1, failureCount: 1,
      responses: tokens.map(t => (t === 'fcm-stale'
        ? { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'Requested entity was not found.' } }
        : { success: true })),
    }))
    const logged = (['debug', 'info', 'warn', 'error'] as const).map(level => jest.spyOn(logger, level))

    await dispatchAlertNotification(alert('HIGH'))

    expect(await tokensOf(owner)).toEqual(['fcm-good'])
    const allLogs = JSON.stringify(logged.flatMap(spy => spy.mock.calls))
    expect(allLogs).toContain('messaging/registration-token-not-registered')
    expect(allLogs).not.toContain('fcm-stale')
    expect(allLogs).not.toContain('fcm-good')
  })

  it('sends nothing and does not fail while Firebase is not configured', async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    resetPushForTests()
    const owner = await mkUser()
    const alert = await farmOf(owner)
    await register(owner, 'fcm-phone').expect(200)

    await expect(dispatchAlertNotification(alert('CRITICAL'))).resolves.toBeUndefined()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('removes the tokens of an account when it is anonymised', async () => {
    const admin = await mkUser({ role: 'ADMIN' })
    const user = await mkUser({ deletion_requested_at: new Date() })
    await register(user, 'fcm-leaving').expect(200)

    await completeDeletionRequest(String(admin._id), String(user._id))

    expect(await PushToken.countDocuments({})).toBe(0)
  })
})
