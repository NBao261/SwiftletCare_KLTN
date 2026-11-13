/**
 * notifyUser / notifyAdmins — thông báo nghiệp vụ (không gắn Alert).
 * Push đi qua push.service (giả lập ở đây, có test riêng ở pushNotification.test.ts); email vẫn là
 * adapter ghi log nên kiểm tra qua logger.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { User } from '@/models/user.model'
import { notifyAdmins, notifyUser } from '@/services/notification.service'
import { sendPushToUser } from '@/services/push.service'
import logger from '@/utils/logger.util'

jest.mock('@/services/push.service', () => ({ sendPushToUser: jest.fn().mockResolvedValue(1) }))

let mongod: MongoMemoryServer
const infoSpy = jest.spyOn(logger, 'info').mockImplementation((() => logger) as never)
const warnSpy = jest.spyOn(logger, 'warn').mockImplementation((() => logger) as never)

const sentTo = (channel: string): Array<Record<string, unknown>> => channel === 'push'
  ? jest.mocked(sendPushToUser).mock.calls.map(([userId, msg]) => ({ userId, ...msg }))
  : (infoSpy.mock.calls as unknown[][])
    .filter(c => String(c[0]).includes(`[notify:${channel}]`))
    .map(c => c[1] as Record<string, unknown>)

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
  await User.deleteMany({})
})

const message = { title: 'Lịch hẹn kỹ thuật đã thay đổi', body: 'Technician dời lịch hẹn sang ngày mai.' }

describe('notifyUser', () => {
  it('sends push and email by default', async () => {
    const user = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })

    await notifyUser(String(user._id), message)

    expect(sentTo('push')).toHaveLength(1)
    expect(sentTo('email')).toEqual([expect.objectContaining({ email: 'owner@test.vn', subject: message.title })])
  })

  it('passes what the app should open with the push (ALERT-FR-002)', async () => {
    const user = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
    const reportId = String(new mongoose.Types.ObjectId())

    await notifyUser(String(user._id), { ...message, ref: { kind: 'health_report', id: reportId } })

    expect(sentTo('push')).toEqual([expect.objectContaining({
      userId: String(user._id), title: message.title, data: { kind: 'health_report', id: reportId }, urgent: false,
    })])
  })

  it('skips push when the user turned it off but still emails', async () => {
    const user = await User.create({
      email: 'quiet@test.vn', password_hash: 'password123', full_name: 'Quiet', role: 'FARM_OWNER',
      notification_preferences: { push: false, quiet_hours: { start: '22:00', end: '06:00' } },
    })

    await notifyUser(String(user._id), message)

    expect(sentTo('push')).toHaveLength(0)
    expect(sentTo('email')).toHaveLength(1)
  })

  it('ignores quiet hours (transactional notices are not environment alerts)', async () => {
    const user = await User.create({
      email: 'night@test.vn', password_hash: 'password123', full_name: 'Night', role: 'FARM_OWNER',
      notification_preferences: {
        push: true,
        quiet_hours: { start: '00:00', end: '23:59' }, // gần như cả ngày là giờ im lặng
      },
    })

    await notifyUser(String(user._id), message)

    expect(sentTo('push')).toHaveLength(1)
  })

  it('emails an overriding address instead of the current one (used after the account was anonymized)', async () => {
    const user = await User.create({ email: 'deleted-x@swiftletcare.local', password_hash: 'password123', full_name: 'Gone', role: 'FARM_OWNER' })

    await notifyUser(String(user._id), message, { email: 'real@test.vn' })

    expect(sentTo('email')).toEqual([expect.objectContaining({ email: 'real@test.vn' })])
  })

  it('emailOnly sends no push even when the user has push enabled', async () => {
    const user = await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })

    await notifyUser(String(user._id), message, { emailOnly: true })

    expect(sentTo('push')).toHaveLength(0)
    expect(sentTo('email')).toHaveLength(1)
  })

  it('does nothing and does not throw for an unknown user', async () => {
    await expect(notifyUser(String(new mongoose.Types.ObjectId()), message)).resolves.toBeUndefined()
    expect(sentTo('push')).toHaveLength(0)
    expect(sentTo('email')).toHaveLength(0)
  })

  it('swallows failures so the business flow is never broken', async () => {
    await expect(notifyUser('not-an-object-id', message)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })
})

describe('notifyAdmins', () => {
  it('notifies only active administrators', async () => {
    await User.create({ email: 'admin1@test.vn', password_hash: 'password123', full_name: 'A1', role: 'ADMIN' })
    await User.create({ email: 'admin2@test.vn', password_hash: 'password123', full_name: 'A2', role: 'ADMIN', is_active: false })
    await User.create({ email: 'owner@test.vn', password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })

    await notifyAdmins(message)

    expect(sentTo('email').map(e => e.email)).toEqual(['admin1@test.vn'])
  })
})
