import crypto from 'crypto'
import { User } from '@/models/user.model'
import { NotFoundError, ServiceUnavailableError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'

/**
 * Telegram bot — ALERT-FR-013 (SRS v2.0.0): kênh thông báo ngoài ứng dụng chạy thật.
 *
 * Liên kết bằng mã một lần: người dùng bấm "Kết nối Telegram" → nhận deep link
 * `https://t.me/<bot>?start=<mã>` → mở bot, Telegram gửi `/start <mã>` → backend lưu
 * `users.telegram_chat_id`. Token bot nằm ở biến môi trường `TELEGRAM_BOT_TOKEN`
 * (tạo bot qua @BotFather), không commit. Dùng `fetch` có sẵn của Node 20.
 */
const API_BASE = 'https://api.telegram.org'
/** Telegram treo thì bỏ sau 10 giây — không để 1 request chặn thông báo của người khác */
const SEND_TIMEOUT_MS = 10_000
/** getUpdates chờ tối đa 25 giây phía Telegram (long polling) nên hạn phải dài hơn */
const POLL_TIMEOUT_MS = 35_000
/** Mã liên kết sống 10 phút — đủ để mở Telegram, ngắn để mã lộ ra cũng hết hạn nhanh */
export const LINK_CODE_TTL_MS = 10 * 60_000

const botToken = () => process.env.TELEGRAM_BOT_TOKEN || ''
const botUsername = () => (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '')
export const isTelegramConfigured = () => botToken() !== ''

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

async function callTelegram<T = unknown>(method: string, body: Record<string, unknown>, timeoutMs = SEND_TIMEOUT_MS): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string }
  if (!res.ok || !json.ok) throw new Error(`Telegram ${method} thất bại: ${json.description ?? res.status}`)
  return json.result as T
}

/**
 * Gửi 1 tin nhắn. Không throw: kênh thông báo hỏng không được làm hỏng luồng ghi cảnh
 * báo. Trả false khi chưa cấu hình bot hoặc Telegram từ chối.
 */
export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!isTelegramConfigured()) return false
  try {
    await callTelegram('sendMessage', { chat_id: chatId, text })
    return true
  } catch (err) {
    // Không log token; `err.message` chỉ chứa mô tả lỗi của Telegram
    logger.warn('[notify:telegram] gửi thất bại', { chatId, err: (err as Error).message })
    return false
  }
}

/** ALERT-FR-013 — tạo mã liên kết một lần + deep link mở bot */
export async function createTelegramLink(userId: string): Promise<{ deep_link: string; expires_at: Date }> {
  if (!isTelegramConfigured() || !botUsername()) {
    throw ServiceUnavailableError('Chưa cấu hình bot Telegram (TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME)')
  }
  const code = crypto.randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS)
  const { matchedCount } = await User.updateOne(
    { _id: userId },
    { telegram_link_code_hash: sha256(code), telegram_link_expires_at: expiresAt },
  )
  if (!matchedCount) throw NotFoundError('Không tìm thấy người dùng')
  return { deep_link: `https://t.me/${botUsername()}?start=${code}`, expires_at: expiresAt }
}

/** Hủy liên kết bất cứ lúc nào — thôi nhận tin, xoá luôn mã liên kết còn treo */
export async function unlinkTelegram(userId: string): Promise<void> {
  await User.updateOne(
    { _id: userId },
    { $unset: { telegram_chat_id: 1, telegram_link_code_hash: 1, telegram_link_expires_at: 1 } },
  )
}

interface TelegramUpdate {
  update_id: number
  message?: { text?: string; chat?: { id: number | string; type?: string } }
}

/**
 * Xử lý 1 update của bot. `/start <mã>` hợp lệ → lưu chat id cho user giữ mã đó (mã
 * dùng một lần). Mọi tin khác được trả lời hướng dẫn — bot không nhận lệnh nào khác.
 */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const chatId = update.message?.chat?.id
  const text = update.message?.text?.trim()
  if (chatId === undefined || !text) return

  // Chỉ liên kết với chat RIÊNG. Gửi /start <mã> trong một nhóm có bot sẽ gắn tài khoản
  // với cả nhóm: mọi cảnh báo của farm đổ vào nhóm và tin xác nhận in email ra đó. Không
  // tiêu mã, không nhắc gì tới tài khoản — chỉ hướng dẫn nhắn riêng cho bot.
  if (update.message?.chat?.type !== 'private') {
    await sendTelegram(String(chatId), 'Bot SwiftletCare chỉ kết nối trong chat riêng. Hãy mở chat riêng với bot rồi bấm lại "Kết nối Telegram" trong ứng dụng.')
    return
  }

  const code = /^\/start\s+([0-9a-f]{32})$/i.exec(text)?.[1]
  if (!code) {
    await sendTelegram(String(chatId), 'Đây là bot thông báo của SwiftletCare. Để nhận cảnh báo, mở Cài đặt trong ứng dụng và bấm "Kết nối Telegram".')
    return
  }

  const user = await User.findOneAndUpdate(
    { telegram_link_code_hash: sha256(code.toLowerCase()), telegram_link_expires_at: { $gt: new Date() } },
    { telegram_chat_id: String(chatId), $unset: { telegram_link_code_hash: 1, telegram_link_expires_at: 1 } },
  )
  // Một chat chỉ thuộc về một tài khoản: liên kết lại bằng tài khoản khác thì gỡ khỏi tài khoản cũ
  if (user) {
    await User.updateMany({ _id: { $ne: user._id }, telegram_chat_id: String(chatId) }, { $unset: { telegram_chat_id: 1 } })
  }
  await sendTelegram(String(chatId), user
    ? `Đã kết nối với tài khoản ${user.email}. Bạn sẽ nhận cảnh báo của nhà yến tại đây.`
    : 'Mã kết nối không đúng hoặc đã hết hạn. Hãy bấm "Kết nối Telegram" trong ứng dụng để lấy mã mới.')
}

/**
 * Nhận `/start <mã>` bằng long polling (getUpdates) — chạy được trên máy dev không cần
 * URL công khai. Chỉ khởi động khi có token và không phải môi trường test.
 * ponytail: polling trong tiến trình, chỉ đúng khi chạy MỘT instance backend (2 instance
 * cùng getUpdates sẽ giành update của nhau) — khi triển khai nhiều instance hoặc có tên
 * miền HTTPS thì chuyển sang webhook (setWebhook) gọi thẳng handleTelegramUpdate.
 */
export function startTelegramPolling(): void {
  if (!isTelegramConfigured() || process.env.NODE_ENV === 'test') {
    if (!isTelegramConfigured()) logger.info('TELEGRAM_BOT_TOKEN chưa đặt — không bật kênh Telegram (ALERT-FR-013)')
    return
  }
  let offset = 0
  const loop = async (): Promise<void> => {
    for (;;) {
      try {
        const updates = await callTelegram<TelegramUpdate[]>('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, POLL_TIMEOUT_MS)
        for (const update of updates) {
          offset = update.update_id + 1
          await handleTelegramUpdate(update).catch((err: Error) => logger.warn('Xử lý update Telegram lỗi', { err: err.message }))
        }
      } catch (err) {
        logger.warn('Telegram getUpdates lỗi — thử lại sau 5 giây', { err: (err as Error).message })
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }
  void loop()
  logger.info('Telegram bot polling started (ALERT-FR-013)')
}
