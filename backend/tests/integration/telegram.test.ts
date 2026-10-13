/**
 * ALERT-FR-013 (SRS v2.0.0) — kênh Telegram: liên kết bằng mã một lần qua `/start <mã>`,
 * gửi cảnh báo theo cùng luật với push (người nhận, giờ im lặng, ngoại lệ CRITICAL).
 * `fetch` tới api.telegram.org được giả lập — test không gọi mạng thật.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import authRoutes from '@/routes/auth.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert, IAlert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { User } from '@/models/user.model'
import { dispatchAlertNotification } from '@/services/notification.service'
import { handleTelegramUpdate, sendTelegram } from '@/services/telegram.service'
import type { AlertSeverity } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/auth', authRoutes)
app.use(errorHandler)

const fetchMock = jest.fn()
let mongod: MongoMemoryServer
beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  global.fetch = fetchMock as unknown as typeof fetch
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = 'TEST_TOKEN'
  process.env.TELEGRAM_BOT_USERNAME = 'swiftletcare_test_bot'
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, result: {} }) })
})
afterEach(async () => {
  await Promise.all([Alert, Farm, User].map(m => (m as typeof User).deleteMany({})))
})

let seq = 0
const mkUser = (over: Record<string, unknown> = {}) =>
  User.create({ email: `u${++seq}@test.vn`, password_hash: 'password123', full_name: 'U', role: 'FARM_OWNER', ...over })
const tokenOf = (u: { _id: unknown }) => jwt.sign({ sub: String(u._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
const start = (code: string, chatId = 777) => handleTelegramUpdate({ update_id: 1, message: { text: `/start ${code}`, chat: { id: chatId } } })
/** Các tin bot đã gửi: [chat_id, text] */
const sent = () => fetchMock.mock.calls
  .filter(c => String(c[0]).endsWith('/sendMessage'))
  .map(c => JSON.parse(c[1].body as string) as { chat_id: string; text: string })

async function link(user: { _id: unknown }) {
  const res = await request(app).post('/auth/telegram/link').set('Authorization', `Bearer ${tokenOf(user)}`).expect(200)
  return { deepLink: res.body.data.deep_link as string, code: (res.body.data.deep_link as string).split('start=')[1] }
}

describe('liên kết bot Telegram', () => {
  it('deep link chứa mã một lần; /start <mã> lưu chat id; mã không dùng lại được', async () => {
    const user = await mkUser()
    const { deepLink, code } = await link(user)
    expect(deepLink).toMatch(/^https:\/\/t\.me\/swiftletcare_test_bot\?start=[0-9a-f]{32}$/)

    await start(code)
    expect((await User.findById(user._id))!.telegram_chat_id).toBe('777')
    expect(sent().at(-1)).toMatchObject({ chat_id: '777', text: expect.stringContaining(user.email) })
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.telegram.org/botTEST_TOKEN/sendMessage')
    // Có hạn chờ: Telegram treo không được giữ request mãi
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)

    // Người khác gửi lại đúng mã đó: không chiếm được liên kết
    await start(code, 999)
    expect((await User.findById(user._id))!.telegram_chat_id).toBe('777')
    expect(sent().at(-1)).toMatchObject({ chat_id: '999', text: expect.stringContaining('không đúng hoặc đã hết hạn') })
  })

  it('mã hết hạn hoặc sai bị từ chối; tin không phải /start chỉ được trả lời hướng dẫn', async () => {
    const user = await mkUser()
    const { code } = await link(user)
    await User.updateOne({ _id: user._id }, { telegram_link_expires_at: new Date(Date.now() - 1000) })
    await start(code)
    await start('0'.repeat(32))
    await handleTelegramUpdate({ update_id: 2, message: { text: 'xin chào', chat: { id: 5 } } })

    expect((await User.findById(user._id))!.telegram_chat_id).toBeUndefined()
    expect(sent().map(m => m.text)).toEqual([
      expect.stringContaining('hết hạn'), expect.stringContaining('hết hạn'), expect.stringContaining('Kết nối Telegram'),
    ])
  })

  it('API không lộ chat id hay mã liên kết, chỉ báo đã liên kết; hủy liên kết được', async () => {
    const user = await mkUser()
    const { code } = await link(user)
    await start(code)

    const json = (await User.findById(user._id))!.toJSON() as Record<string, unknown>
    expect(json.telegram_linked).toBe(true)
    expect(json).not.toHaveProperty('telegram_chat_id')
    expect(json).not.toHaveProperty('telegram_link_code_hash')

    await request(app).delete('/auth/telegram/link').set('Authorization', `Bearer ${tokenOf(user)}`).expect(200)
    expect((await User.findById(user._id))!.telegram_chat_id).toBeUndefined()
  })

  it('chưa cấu hình bot: tạo liên kết trả 503 và không gọi Telegram', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    const user = await mkUser()
    await request(app).post('/auth/telegram/link').set('Authorization', `Bearer ${tokenOf(user)}`).expect(503)
    expect(await sendTelegram('1', 'x')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Telegram từ chối thì sendTelegram trả false chứ không ném lỗi', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ ok: false, description: 'bot was blocked by the user' }) })
    expect(await sendTelegram('1', 'x')).toBe(false)
  })
})

describe('gửi cảnh báo qua Telegram', () => {
  const NIGHT = { start: '00:00', end: '24:00' } // luôn trong giờ im lặng
  const DAY = { start: '00:00', end: '00:00' }   // không bao giờ im lặng

  async function farmWith(quiet: { start: string; end: string }, telegram = true) {
    const owner = await mkUser({ telegram_chat_id: '100', notification_preferences: { push: false, telegram, zalo: false, sms: false, quiet_hours: quiet } })
    const coOwner = await mkUser({ notification_preferences: { push: false, telegram: true, zalo: false, sms: false, quiet_hours: quiet } }) // chưa liên kết
    const expert = await mkUser({ role: 'DOMAIN_EXPERT', telegram_chat_id: '300', notification_preferences: { push: false, telegram: true, zalo: false, sms: false, quiet_hours: quiet } })
    const farm = await Farm.create({
      name: 'F', address: 'x', owner_id: owner._id,
      members: [{ user_id: owner._id, is_primary: true }, { user_id: coOwner._id, role: 'FARM_OWNER' }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
    })
    const alert = (severity: AlertSeverity) =>
      new Alert({ farm_id: farm._id, type: 'PUMP_DRY', severity, title: 'Bơm chạy khô', message: 'Đã ngừng phun' }) as IAlert
    return { alert }
  }

  it('gửi tới chủ farm đã liên kết; không gửi cho người chưa liên kết và Domain Expert', async () => {
    const { alert } = await farmWith(DAY)
    await dispatchAlertNotification(alert('MEDIUM'))
    expect(sent()).toEqual([{ chat_id: '100', text: '[MEDIUM] Bơm chạy khô — Đã ngừng phun' }])
  })

  it('tôn trọng giờ im lặng, trừ cảnh báo CRITICAL', async () => {
    const { alert } = await farmWith(NIGHT)
    await dispatchAlertNotification(alert('HIGH'))
    expect(sent()).toHaveLength(0)
    await dispatchAlertNotification(alert('CRITICAL'))
    expect(sent()).toHaveLength(1)
  })

  it('Telegram treo với 1 người không chặn người nhận khác', async () => {
    const { alert } = await farmWith(DAY)
    await User.updateMany({ role: 'FARM_OWNER', telegram_chat_id: { $exists: false } }, { telegram_chat_id: '200' }) // đồng sở hữu cũng liên kết
    fetchMock.mockImplementation((_url: string, init: { body: string }) =>
      (JSON.parse(init.body) as { chat_id: string }).chat_id === '100'
        ? Promise.reject(new Error('timeout'))
        : Promise.resolve({ ok: true, json: async () => ({ ok: true, result: {} }) }))

    await expect(dispatchAlertNotification(alert('CRITICAL'))).resolves.toBeUndefined()
    expect(sent().map(m => m.chat_id).sort()).toEqual(['100', '200'])
  })

  it('tắt kênh Telegram trong tuỳ chọn thì không gửi', async () => {
    const { alert } = await farmWith(DAY, false)
    await dispatchAlertNotification(alert('CRITICAL'))
    expect(sent()).toHaveLength(0)
  })
})
