import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import logger from '@/utils/logger.util'
import type { IAlert } from '@/models/alert.model'
import type { NotificationPreferences } from '@/types'

/**
 * Notification Service — ALERT-FR-002..006.
 *
 * PHẠM VI HIỆN TẠI: toàn bộ logic định tuyến (chọn người nhận, chọn kênh, giờ
 * im lặng, ngoại lệ CRITICAL) đã cài đặt thật và test được. Riêng bước GỬI cuối
 * cùng tới Firebase FCM / Zalo ZNS / SMS mới dừng ở mức ghi log, vì chưa có
 * credential thật của 3 dịch vụ này (RISK-07, checklist E6). Khi có key, chỉ cần
 * thay phần thân 3 hàm `sendPush/sendZalo/sendSms` — không phải sửa logic định tuyến.
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

/** Người cần nhận cảnh báo của 1 farm: mọi thành viên Farm Owner (AUTH-FR-005) */
async function findRecipients(farmId: string) {
  const farm = await Farm.findById(farmId)
  if (!farm) return []

  const userIds = [farm.owner_id, ...farm.members.map(m => m.user_id)]
  return User.find({ _id: { $in: userIds }, is_active: true }).lean()
}

export async function dispatchAlertNotification(alert: IAlert): Promise<void> {
  const recipients = await findRecipients(String(alert.farm_id))
  if (recipients.length === 0) {
    logger.warn('Cảnh báo không có người nhận', { alertId: String(alert._id), farmId: String(alert.farm_id) })
    return
  }

  for (const user of recipients) {
    const prefs = user.notification_preferences
    const muted = isWithinQuietHours(prefs) && alert.severity !== 'CRITICAL'
    if (muted) {
      logger.debug('Bỏ qua thông báo do giờ im lặng (ALERT-FR-006)', {
        alertId: String(alert._id), userId: String(user._id), severity: alert.severity,
      })
      continue
    }

    const body = `[${alert.severity}] ${alert.title} — ${alert.message}`

    // ALERT-FR-002: Push cho mọi mức; ALERT-FR-003: Zalo ZNS chỉ CRITICAL/HIGH;
    // ALERT-FR-004: SMS là kênh dự phòng, chỉ dùng cho CRITICAL.
    if (prefs?.push) await sendPush(String(user._id), alert.title, body)
    if (prefs?.zalo && (alert.severity === 'CRITICAL' || alert.severity === 'HIGH')) {
      await sendZalo(user.phone, body)
    }
    if (prefs?.sms && alert.severity === 'CRITICAL') await sendSms(user.phone, body)
  }
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
