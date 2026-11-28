import { User, SIGN_IN_FILTER, canSignIn } from '@/models/user.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Notification, type NotificationRefKind } from '@/models/notification.model'
import { sendPushToUser } from '@/services/push.service'
import { sendTelegram } from '@/services/telegram.service'
import { emitNotificationNew } from '@/socket'
import { NotFoundError } from '@/utils/appError.util'
import { activeExpertIds } from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import { channelEnabled } from '@/utils/notificationChannels.util'
import { SEVERITY_LABEL } from '@/utils/displayLabel.util'
import { alertTelegram, noticeTelegram, placeLine, type AlertPlace } from '@/utils/telegramMessage.util'
import type { IAlert } from '@/models/alert.model'
import type { CurrentUser, NotificationPreferences } from '@/types'

// Mỗi kênh ngoài ứng dụng (Telegram, push) tự bỏ qua khi chưa cấu hình

// không chặn CRITICAL
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

  // Khung thường vắt qua nửa đêm (22:00 → 06:00)
  return start <= end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end
}

// Domain Expert không nhận cảnh báo ngoài ứng dụng; chọn người nhận ở alertRouting.service
export async function findRecipients(farmId: string) {
  const farm = await Farm.findById(farmId)
  if (!farm) return []

  const members = farm.members.filter(m => m.role !== 'DOMAIN_EXPERT' && m.role !== 'FARM_TECHNICIAN')
  const userIds = [farm.owner_id, ...members.map(m => m.user_id)]
  return User.find({ _id: { $in: userIds }, ...SIGN_IN_FILTER }).lean()
}

// Chuyên gia bị khoá không nhận
export async function findFarmExperts(farmId: unknown): Promise<string[]> {
  const farm = await Farm.findById(farmId).select('members')
  return farm ? activeExpertIds(farm) : []
}

// Chỉ trong ứng dụng. Không throw
export async function notifyExpertsOfProposal(
  farmId: unknown, author: CurrentUser,
  message: { what: string; body: string; ref: { kind: NotificationRefKind; id: string }; prefix?: string },
): Promise<number> {
  try {
    const [experts, user] = await Promise.all([findFarmExperts(farmId), User.findById(author._id).select('full_name').lean()])
    const title = `${message.prefix ?? 'Cần duyệt'}: ${user?.full_name ?? author.email} ${message.what}`
    await Promise.all(experts.map(expertId => createInAppNotification(expertId, { title, body: message.body, ref: message.ref })))
    return experts.length
  } catch (err) {
    logger.warn('Báo chuyên gia việc của Farm Owner thất bại', { err, farmId: String(farmId), what: message.what })
    return 0
  }
}

// Chỉ trong ứng dụng. Farm chưa có chuyên gia thì tới Farm Owner
async function notifyExpertsPendingVerdict(alert: IAlert): Promise<void> {
  const farm = await Farm.findById(alert.farm_id).select('members')
  if (!farm) return
  const experts = await activeExpertIds(farm)
  // findRecipients đã bỏ tài khoản LOCKED, DELETED
  const deciders = experts.length > 0 ? experts : (await findRecipients(String(alert.farm_id))).map(u => String(u._id))
  await Promise.all(deciders.map(id => createInAppNotification(id, {
    title: `Cảnh báo chờ kiểm chứng: ${alert.title}`,
    body: alert.message,
    ref: { kind: 'alert', id: String(alert._id) },
  })))
}

export { channelEnabled } from '@/utils/notificationChannels.util'

// Tên trang trại, nhà, Zone và thiết bị của cảnh báo, tra một lần cho mọi người nhận. Lỗi tra thì tin vẫn đi, chỉ thiếu vị trí
async function alertPlace(alert: IAlert): Promise<AlertPlace> {
  try {
    const zone = alert.zone_id ? await Zone.findById(alert.zone_id).select('name house_id').lean() : null
    const houseId = alert.house_id ?? zone?.house_id
    const [house, farm, sensor, camera] = await Promise.all([
      houseId ? House.findById(houseId).select('name').lean() : null,
      Farm.findById(alert.farm_id).select('name').lean(),
      alert.node_id ? SensorNode.findById(alert.node_id).select('device_id').lean() : null,
      alert.node_id ? CameraNode.findById(alert.node_id).select('device_id').lean() : null,
    ])
    return { farm: farm?.name, house: house?.name, zone: zone?.name, device: sensor?.device_id ?? camera?.device_id }
  } catch (err) {
    logger.warn('Không tra được vị trí của cảnh báo', { alertId: String(alert._id), err })
    return {}
  }
}

export interface DispatchAlertOptions {
  awaitsVerdict?: boolean
  repeat?: boolean
  escalation?: boolean
  // Không có = Farm Owner của farm
  recipientIds?: string[]
}

export async function dispatchAlertNotification(alert: IAlert, opts: DispatchAlertOptions = {}): Promise<void> {
  if (opts.awaitsVerdict) {
    // Lỗi chỉ ghi log, không chặn kênh của Farm Owner
    void notifyExpertsPendingVerdict(alert).catch((err: Error) =>
      logger.warn('Báo chuyên gia có cảnh báo chờ kiểm chứng thất bại', { alertId: String(alert._id), err }),
    )
  }
  const recipients = opts.recipientIds
    ? await User.find({ _id: { $in: opts.recipientIds }, ...SIGN_IN_FILTER }).lean()
    : await findRecipients(String(alert.farm_id))
  if (recipients.length === 0) {
    logger.warn('Cảnh báo không có người nhận', { alertId: String(alert._id), farmId: String(alert.farm_id) })
    return
  }

  const place = await alertPlace(alert)
  // Gửi song song: 1 người lỗi không chặn cảnh báo của người khác
  const results = await Promise.allSettled(recipients.map(async user => {
    const prefs = user.notification_preferences
    const muted = isWithinQuietHours(prefs) && alert.severity !== 'CRITICAL'
    if (muted) {
      logger.debug('Bỏ qua thông báo do giờ im lặng (ALERT-FR-006)', {
        alertId: String(alert._id), userId: String(user._id), severity: alert.severity,
      })
      return
    }

    const title = opts.escalation ? `Chưa ai xác nhận: ${alert.title}` : opts.repeat ? `Nhắc lại: ${alert.title}` : alert.title
    // Không đưa mã enum ra tin nhắn (FE_Design). Tiêu đề push là tên cảnh báo; thân tin là mức, vị trí rồi nội dung
    const body = `${[SEVERITY_LABEL[alert.severity], placeLine(place)].filter(Boolean).join(' · ')}\n${alert.message}`
    const telegram = alertTelegram({
      alertId: String(alert._id), severity: alert.severity, title: alert.title, message: alert.message,
      at: alert.created_at ?? new Date(), place, kind: opts.escalation ? 'escalation' : opts.repeat ? 'repeat' : undefined,
    })

    // Các kênh chạy song song; kênh lỗi ghi log riêng
    const channels: Array<[string, Promise<unknown> | undefined]> = [
      ['push', channelEnabled(prefs, alert.severity, 'push') ? sendPush(String(user._id), title, body, { kind: 'alert', id: String(alert._id) }, alert.severity === 'CRITICAL') : undefined],
      ['telegram', channelEnabled(prefs, alert.severity, 'telegram') && user.telegram_chat_id ? sendTelegram(user.telegram_chat_id, telegram) : undefined],
    ]
    const outcomes = await Promise.allSettled(channels.map(([, sending]) => sending))
    outcomes.forEach((outcome, i) => {
      if (outcome.status === 'rejected') {
        logger.warn('Gửi thông báo cảnh báo thất bại', { alertId: String(alert._id), userId: String(user._id), channel: channels[i][0], err: outcome.reason })
      }
    })
  }))
  // Lỗi ngoài các kênh không được nuốt im lặng
  results.forEach(result => {
    if (result.status === 'rejected') logger.warn('Xử lý thông báo cho 1 người nhận thất bại', { alertId: String(alert._id), err: result.reason })
  })
}

// ref để app mở đúng màn hình
async function sendPush(userId: string, title: string, body: string, ref?: UserNotification['ref'], urgent = false): Promise<void> {
  await sendPushToUser(userId, { title, body, data: ref ? { kind: ref.kind, id: ref.id } : undefined, urgent })
}

async function sendEmail(email: string | undefined, subject: string, body: string): Promise<void> {
  // Thông báo nghiệp vụ chưa gửi e-mail thật; thư tài khoản đi qua mail.service
  logger.info('[notify:email] (chưa nối SMTP thật)', { email, subject, body })
}

export interface UserNotification {
  title: string
  body: string
  ref?: { kind: NotificationRefKind; id: string }
}

export interface NotifyUserOptions {
  // Khi tài khoản vừa bị ẩn danh
  email?: string
  emailOnly?: boolean
}

// Không áp giờ im lặng và luôn gửi thêm email. Không throw. Sau khi ẩn danh thì truyền email cũ
export async function notifyUser(userId: string, message: UserNotification, opts: NotifyUserOptions = {}): Promise<void> {
  try {
    const user = await User.findById(userId).select('email status notification_preferences telegram_chat_id').lean()
    if (!user) return

    // Khoá/xoá thì không nhận push, Telegram; email vẫn gửi để báo chính họ
    const emailOnly = opts.emailOnly || !canSignIn(user)
    // Lỗi hộp thông báo không được làm mất Telegram/email phía sau
    if (!emailOnly) {
      await createInAppNotification(String(user._id), message).catch((err: Error) =>
        logger.warn('Ghi thông báo trong ứng dụng thất bại', { err, userId, title: message.title }))
    }
    if (!emailOnly && user.notification_preferences?.push !== false) {
      await sendPush(String(user._id), message.title, message.body, message.ref)
    }
    if (!emailOnly && user.notification_preferences?.telegram !== false && user.telegram_chat_id) {
      await sendTelegram(user.telegram_chat_id, noticeTelegram(message))
    }
    await sendEmail(opts.email ?? user.email, message.title, message.body)
  } catch (err) {
    logger.warn('Gửi thông báo nghiệp vụ thất bại', { err, userId, title: message.title })
  }
}

export async function notifyAdmins(message: UserNotification): Promise<void> {
  try {
    const admins = await User.find({ role: 'ADMIN', ...SIGN_IN_FILTER }).select('_id').lean()
    await Promise.all(admins.map(a => notifyUser(String(a._id), message)))
  } catch (err) {
    logger.warn('Gửi thông báo tới Admin thất bại', { err, title: message.title })
  }
}

export interface NotificationDto {
  _id: string
  title: string
  body: string
  ref?: { kind: NotificationRefKind; id: string }
  read_at: Date | null
  created_at: Date
}

// Lưu trước rồi mới phát socket: người offline vẫn thấy
export async function createInAppNotification(userId: string, message: UserNotification): Promise<void> {
  const doc = await Notification.create({ user_id: userId, title: message.title, body: message.body, ref: message.ref })
  emitNotificationNew(userId, {
    _id: String(doc._id), title: doc.title, body: doc.body,
    ref: message.ref, read_at: null, created_at: doc.created_at,
  })
}

export async function listNotifications(user: CurrentUser, query: { page?: number; limit?: number; unread?: boolean }) {
  const { page, skip, limit } = paginate(query.page, query.limit)
  const filter = { user_id: user._id, ...(query.unread && { read_at: null }) }
  const [records, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).select('-user_id').lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user_id: user._id, read_at: null }),
  ])
  return { records, total, page, limit, unreadCount }
}

// Của người khác trả 404, không lộ id có thật
export async function markNotificationRead(id: string, user: CurrentUser) {
  const doc = await Notification.findOneAndUpdate(
    { _id: id, user_id: user._id, read_at: null },
    { read_at: new Date() },
    { new: true },
  ).select('-user_id').lean()
    // Giữ thời điểm đọc đầu tiên
    ?? await Notification.findOne({ _id: id, user_id: user._id }).select('-user_id').lean()
  if (!doc) throw NotFoundError('Không tìm thấy thông báo')
  return doc
}

export async function markAllNotificationsRead(user: CurrentUser): Promise<{ modified: number }> {
  const { modifiedCount } = await Notification.updateMany({ user_id: user._id, read_at: null }, { read_at: new Date() })
  return { modified: modifiedCount }
}
