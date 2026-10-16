import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { sendTelegram } from '@/services/telegram.service'
import logger from '@/utils/logger.util'
import type { IAlert } from '@/models/alert.model'
import type { NotificationPreferences } from '@/types'

/**
 * Notification Service — ALERT-FR-002..006.
 *
 * PHẠM VI HIỆN TẠI: toàn bộ logic định tuyến (chọn người nhận, chọn kênh, giờ
 * im lặng, ngoại lệ CRITICAL) đã cài đặt thật và test được. Kênh ngoài ứng dụng
 * CHẠY THẬT là Telegram bot (ALERT-FR-013, services/telegram.service.ts) — phiếu v2
 * cam kết "Telegram bot hoặc push", chỉ cần một trong hai. Firebase FCM vẫn dừng ở
 * mức ghi log; Zalo ZNS và SMS nằm ngoài phạm vi SRS v2.0.0, adapter để nguyên không nối.
 */

/** ALERT-FR-006 — giờ im lặng chỉ chặn được cảnh báo dưới mức CRITICAL */
function isWithinQuietHours(prefs: NotificationPreferences, now = new Date()): boolean {
  const quiet = prefs?.quiet_hours
  if (!quiet?.start || !quiet?.end) return false

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const start = toMinutes(quiet.start)
  const end = toMinutes(quiet.end)

  // Khung giờ im lặng thường vắt qua nửa đêm (VD 22:00 → 06:00) nên phải xử lý
  // 2 trường hợp, không so sánh start < end một cách ngây thơ.
  return start <= end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end
}

/**
 * Người nhận cảnh báo vận hành của 1 farm (ALERT-FR-005): chủ farm và mọi đồng sở hữu.
 * Domain Expert KHÔNG nhận cảnh báo vận hành ngoài ứng dụng (EXPERT-FR-007) — đó là
 * việc của Farm Owner; chuyên gia thấy cảnh báo trong ứng dụng và nhận báo cáo sức khỏe.
 */
export async function findRecipients(farmId: string) {
  const farm = await Farm.findById(farmId)
  if (!farm) return []

  const members = farm.members.filter(m => m.role !== 'DOMAIN_EXPERT')
  const userIds = [farm.owner_id, ...members.map(m => m.user_id)]
  return User.find({ _id: { $in: userIds }, is_active: true }).lean()
}

export async function dispatchAlertNotification(alert: IAlert): Promise<void> {
  const recipients = await findRecipients(String(alert.farm_id))
  if (recipients.length === 0) {
    logger.warn('Cảnh báo không có người nhận', { alertId: String(alert._id), farmId: String(alert.farm_id) })
    return
  }

  // Mỗi người nhận gửi độc lập và song song: kênh của 1 người chậm/lỗi không được
  // chặn cảnh báo (nhất là CRITICAL) của những người còn lại.
  const results = await Promise.allSettled(recipients.map(async user => {
    const prefs = user.notification_preferences
    const muted = isWithinQuietHours(prefs) && alert.severity !== 'CRITICAL'
    if (muted) {
      logger.debug('Bỏ qua thông báo do giờ im lặng (ALERT-FR-006)', {
        alertId: String(alert._id), userId: String(user._id), severity: alert.severity,
      })
      return
    }

    const body = `[${alert.severity}] ${alert.title} — ${alert.message}`

    // ALERT-FR-002: Push cho mọi mức; ALERT-FR-013: Telegram theo cùng luật với push
    // (mọi mức, cùng người nhận, cùng giờ im lặng) cho tài khoản đã liên kết bot;
    // ALERT-FR-003: Zalo ZNS chỉ CRITICAL/HIGH; ALERT-FR-004: SMS chỉ cho CRITICAL.
    // Các kênh của 1 người cũng chạy song song; kênh nào ném lỗi thì ghi log riêng,
    // không kéo theo kênh còn lại.
    const channels: Array<[string, Promise<unknown> | undefined]> = [
      ['push', prefs?.push ? sendPush(String(user._id), alert.title, body) : undefined],
      ['telegram', prefs?.telegram !== false && user.telegram_chat_id ? sendTelegram(user.telegram_chat_id, body) : undefined],
      ['zalo', prefs?.zalo && (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') ? sendZalo(user.phone, body) : undefined],
      ['sms', prefs?.sms && alert.severity === 'CRITICAL' ? sendSms(user.phone, body) : undefined],
    ]
    const outcomes = await Promise.allSettled(channels.map(([, sending]) => sending))
    outcomes.forEach((outcome, i) => {
      if (outcome.status === 'rejected') {
        logger.warn('Gửi thông báo cảnh báo thất bại', { alertId: String(alert._id), userId: String(user._id), channel: channels[i][0], err: outcome.reason })
      }
    })
  }))
  // Lỗi ngoài các kênh (đọc tuỳ chọn, tính giờ im lặng) — không được nuốt im lặng
  results.forEach(result => {
    if (result.status === 'rejected') logger.warn('Xử lý thông báo cho 1 người nhận thất bại', { alertId: String(alert._id), err: result.reason })
  })
}

// ── Adapter tới nhà cung cấp ngoài (chưa nối credential thật) ───────────────

async function sendPush(userId: string, title: string, body: string): Promise<void> {
  // TODO(E6): nối Firebase FCM bằng service account; cần lưu device token của
  // từng user khi họ đăng nhập trên PWA (ALERT-FR-002).
  logger.info('[notify:push] (chưa nối FCM thật)', { userId, title, body })
}

async function sendZalo(phone: string | undefined, body: string): Promise<void> {
  // TODO(E6): nối Zalo ZNS template — cần OA đã duyệt template (ALERT-FR-003).
  logger.info('[notify:zalo] (chưa nối ZNS thật)', { phone, body })
}

async function sendSms(phone: string | undefined, body: string): Promise<void> {
  // TODO(E6): nối Twilio/ESMS (ALERT-FR-004, kênh dự phòng khi mạng kém).
  logger.info('[notify:sms] (chưa nối SMS gateway thật)', { phone, body })
}

async function sendEmail(email: string | undefined, subject: string, body: string): Promise<void> {
  // TODO(E6): nối SMTP bằng nodemailer (đã có trong dependencies) — cùng chỗ với luồng OTP/đặt lại mật khẩu.
  logger.info('[notify:email] (chưa nối SMTP thật)', { email, subject, body })
}

// ── Thông báo nghiệp vụ tới 1 người dùng (không gắn với Alert) ─────────────────

export interface UserNotification {
  title: string
  body: string
}

export interface NotifyUserOptions {
  /** Địa chỉ email dùng thay cho email hiện tại của user — cần khi tài khoản vừa bị ẩn danh hoá */
  email?: string
  /** Chỉ gửi email, bỏ qua push (tài khoản đã bị vô hiệu hoá) */
  emailOnly?: boolean
}

/**
 * Thông báo giao dịch tới 1 user: kết quả duyệt Sales Staff (Flow 16), chuyển
 * quyền chủ farm / xoá tài khoản (Flow 19), yêu cầu xoá tài khoản gửi Admin.
 * Khác `dispatchAlertNotification`: không áp giờ im lặng (đây không phải cảnh báo
 * môi trường) và luôn gửi thêm email vì user có thể chưa mở app. Như các kênh
 * khác, bước GỬI cuối dừng ở adapter (chưa có credential thật).
 *
 * Không throw: thông báo hỏng không được làm hỏng nghiệp vụ chính (cùng triết lý
 * với `logAction`). Thông báo sau khi ẩn danh tài khoản thì truyền `email` cũ.
 */
export async function notifyUser(userId: string, message: UserNotification, opts: NotifyUserOptions = {}): Promise<void> {
  try {
    const user = await User.findById(userId).select('email is_active notification_preferences telegram_chat_id').lean()
    if (!user) return

    // Tài khoản bị khoá/đã xoá không nhận push hay Telegram (chat id vẫn còn sau khi khoá);
    // email thì vẫn gửi — đó là đường báo cho chính họ việc bị khoá/xoá.
    const emailOnly = opts.emailOnly || user.is_active === false
    if (!emailOnly && user.notification_preferences?.push !== false) {
      await sendPush(String(user._id), message.title, message.body)
    }
    // Telegram là kênh duy nhất gửi thật (push/email mới ghi log): không đi qua đây thì
    // báo cáo sức khỏe Zone, kết luận của chuyên gia… không tới được ai.
    if (!emailOnly && user.notification_preferences?.telegram !== false && user.telegram_chat_id) {
      await sendTelegram(user.telegram_chat_id, `${message.title}\n${message.body}`)
    }
    await sendEmail(opts.email ?? user.email, message.title, message.body)
  } catch (err) {
    logger.warn('Gửi thông báo nghiệp vụ thất bại', { err, userId, title: message.title })
  }
}

/** Thông báo tới mọi Administrator đang hoạt động (VD: có yêu cầu xoá tài khoản mới) */
export async function notifyAdmins(message: UserNotification): Promise<void> {
  try {
    const admins = await User.find({ role: 'ADMIN', is_active: true }).select('_id').lean()
    await Promise.all(admins.map(a => notifyUser(String(a._id), message)))
  } catch (err) {
    logger.warn('Gửi thông báo tới Admin thất bại', { err, title: message.title })
  }
}
