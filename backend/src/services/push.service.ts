import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { PushToken, type PushPlatform } from '@/models/pushToken.model'
import { AppError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'

/**
 * Push qua Firebase Cloud Messaging — ALERT-FR-002, Report 4 §5.3 (`push`), §5.4.
 *
 * Credential là file JSON service account Firebase, đường dẫn ở biến môi trường
 * `FIREBASE_SERVICE_ACCOUNT_PATH` (file nằm trong .gitignore, không commit). Chưa cấu hình thì không gửi gì, như Telegram khi chưa có token bot. Token của máy
 * không bao giờ được ghi log (Report 4 §11): log chỉ có user, số token và mã lỗi của FCM.
 */

/** FCM báo token không còn dùng được (gỡ app, đổi máy, token hết hạn) → xoá khỏi `pushtokens` */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

/** Token của Expo Push Service, không phải FCM device token mà SDD §5.4 yêu cầu (BM02 A-02) */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[/

let firebaseApp: App | null | undefined

/** Khởi tạo Firebase một lần; file thiếu hoặc sai thì coi như chưa cấu hình và báo 1 lần */
function getFirebaseApp(): App | null {
  if (firebaseApp !== undefined) return firebaseApp
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (!path) return (firebaseApp = null)
  try {
    firebaseApp = getApps()[0] ?? initializeApp({ credential: cert(path) })
  } catch (err) {
    logger.error('[notify:push] FIREBASE_SERVICE_ACCOUNT_PATH không đọc được, push bị tắt', { err: (err as Error).message })
    firebaseApp = null
  }
  return firebaseApp
}

export const isPushConfigured = (): boolean => getFirebaseApp() !== null

/** Chỉ dùng trong test: đọc lại biến môi trường ở lần gửi sau */
export function resetPushForTests(): void {
  firebaseApp = undefined
}

/**
 * ALERT-FR-002 — máy đăng nhập đăng ký token. Token đã thuộc tài khoản khác (máy đổi tài khoản) thì
 * chuyển sang người gọi, để tài khoản cũ không nhận push trên máy này nữa.
 */
export async function registerPushToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
  if (EXPO_TOKEN.test(token)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Cần FCM device token (getDevicePushTokenAsync), không nhận token Expo')
  }
  const upsert = () => PushToken.updateOne(
    { token },
    { $set: { user_id: userId, platform, last_seen_at: new Date() } },
    { upsert: true },
  )
  try {
    await upsert()
  } catch (err) {
    // 2 lần đăng ký cùng token tới cùng lúc: lần sau gặp unique index thì bản ghi đã có, cập nhật lại
    if ((err as { code?: number }).code !== 11000) throw err
    await upsert()
  }
}

/** Đăng xuất: chỉ gỡ token của chính người gọi; không có gì để gỡ vẫn thành công */
export async function removePushToken(userId: string, token: string): Promise<void> {
  await PushToken.deleteOne({ token, user_id: userId })
}

/** Ẩn danh tài khoản (AUTH-FR-012): token là dữ liệu cá nhân và là đường gửi tới máy thật */
export async function removeUserPushTokens(userId: string): Promise<void> {
  await PushToken.deleteMany({ user_id: userId })
}

export interface PushMessage {
  title: string
  body: string
  /** App đọc để mở đúng màn hình, VD `{ kind: 'alert', id }` */
  data?: Record<string, string>
  /** CRITICAL: ưu tiên cao để tới ngay cả khi máy đang tiết kiệm pin (NFR-02) */
  urgent?: boolean
}

/**
 * Gửi tới mọi máy của 1 user; xoá token FCM báo hỏng. Không throw: kênh thông báo hỏng không được
 * làm hỏng luồng ghi cảnh báo. Trả số máy FCM nhận.
 */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<number> {
  const app = getFirebaseApp()
  if (!app) {
    logger.debug('[notify:push] chưa cấu hình FIREBASE_SERVICE_ACCOUNT_PATH, bỏ qua', { userId })
    return 0
  }
  try {
    const records = await PushToken.find({ user_id: userId }).select('+token').lean()
    if (records.length === 0) return 0
    const tokens = records.map(r => r.token)

    const res = await getMessaging(app).sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: { priority: message.urgent ? 'high' : 'normal' },
      apns: { headers: { 'apns-priority': message.urgent ? '10' : '5' } },
    })

    const invalid = res.responses.flatMap((r, i) => (!r.success && INVALID_TOKEN_CODES.has(r.error?.code ?? '') ? [tokens[i]] : []))
    if (invalid.length > 0) await PushToken.deleteMany({ token: { $in: invalid } })
    if (res.failureCount > 0) {
      const codes = [...new Set(res.responses.filter(r => !r.success).map(r => r.error?.code ?? 'unknown'))]
      logger.warn('[notify:push] một số máy không nhận được', { userId, failed: res.failureCount, removed: invalid.length, codes })
    }
    return res.successCount
  } catch (err) {
    logger.warn('[notify:push] gửi thất bại', { userId, err: (err as Error).message })
    return 0
  }
}
