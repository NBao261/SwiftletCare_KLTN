import crypto from 'crypto'
import { User } from '@/models/user.model'
import { BadRequestError, NotFoundError, ServiceUnavailableError } from '@/utils/appError.util'
import { criticalHasOutsideChannel } from '@/utils/notificationChannels.util'
import logger from '@/utils/logger.util'

// Liên kết bằng mã một lần qua deep link `/start <mã>`
const API_BASE = 'https://api.telegram.org'
// Không để 1 request chặn thông báo của người khác
const SEND_TIMEOUT_MS = 10_000
// getUpdates chờ tới 25 s nên hạn phải dài hơn
const POLL_TIMEOUT_MS = 35_000
// Ngắn để mã lộ ra cũng hết hạn nhanh
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

// Không throw. false khi chưa cấu hình hoặc bị từ chối
export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!isTelegramConfigured()) return false
  try {
    await callTelegram('sendMessage', { chat_id: chatId, text })
    return true
  } catch (err) {
    // Không log token
    logger.warn('[notify:telegram] gửi thất bại', { chatId, err: (err as Error).message })
    return false
  }
}

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

// Là kênh ngoài ứng dụng duy nhất của CRITICAL thì không cho huỷ (400)
export async function unlinkTelegram(userId: string): Promise<void> {
  const user = await User.findById(userId).select('notification_preferences telegram_chat_id').lean()
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  if (user.telegram_chat_id && !criticalHasOutsideChannel(user.notification_preferences, false)) {
    throw BadRequestError('Bật push cho cảnh báo CRITICAL trước khi huỷ liên kết Telegram: CRITICAL phải còn ít nhất một kênh ngoài ứng dụng')
  }
  await User.updateOne(
    { _id: userId },
    { $unset: { telegram_chat_id: 1, telegram_link_code_hash: 1, telegram_link_expires_at: 1 } },
  )
}

interface TelegramUpdate {
  update_id: number
  message?: { text?: string; chat?: { id: number | string; type?: string } }
}

// Mã dùng một lần
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const chatId = update.message?.chat?.id
  const text = update.message?.text?.trim()
  if (chatId === undefined || !text) return

  // Chỉ chat riêng: /start trong nhóm sẽ đổ mọi cảnh báo vào nhóm
  if (update.message?.chat?.type !== 'private') return

  const code = /^\/start\s+([0-9a-f]{32})$/i.exec(text)?.[1]
  if (!code) {
    await sendTelegram(String(chatId), 'Đây là bot thông báo của SwiftletCare. Để nhận cảnh báo, mở Cài đặt trong ứng dụng và bấm "Kết nối Telegram".')
    return
  }

  const user = await User.findOneAndUpdate(
    { telegram_link_code_hash: sha256(code.toLowerCase()), telegram_link_expires_at: { $gt: new Date() } },
    { telegram_chat_id: String(chatId), $unset: { telegram_link_code_hash: 1, telegram_link_expires_at: 1 } },
  )
  // Một chat chỉ thuộc một tài khoản
  if (user) {
    await User.updateMany({ _id: { $ne: user._id }, telegram_chat_id: String(chatId) }, { $unset: { telegram_chat_id: 1 } })
  }
  await sendTelegram(String(chatId), user
    ? `Đã kết nối với tài khoản ${user.email}. Bạn sẽ nhận cảnh báo của nhà yến tại đây.`
    : 'Mã kết nối không đúng hoặc đã hết hạn. Hãy bấm "Kết nối Telegram" trong ứng dụng để lấy mã mới.')
}

// Long polling: chạy được không cần URL công khai. Chỉ đúng với 1 instance, nhiều instance thì dùng webhook
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
