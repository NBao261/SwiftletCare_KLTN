import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { PushToken, type PushPlatform } from '@/models/pushToken.model'
import { AppError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'

/** Chưa cấu hình thì không gửi. Không ghi log token */

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

/** Token Expo, không phải FCM device token (BM02 A-02) */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[/

let firebaseApp: App | null | undefined

/** File thiếu hoặc sai thì coi như chưa cấu hình, báo 1 lần */
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

/** Cho test */
export function resetPushForTests(): void {
  firebaseApp = undefined
}

/** Token của tài khoản khác thì chuyển sang người gọi */
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
    // Unique index: lần sau cập nhật lại
    if ((err as { code?: number }).code !== 11000) throw err
    await upsert()
  }
}

/** Không có gì để gỡ vẫn thành công */
export async function removePushToken(userId: string, token: string): Promise<void> {
  await PushToken.deleteOne({ token, user_id: userId })
}

/** AUTH-FR-012 */
export async function removeUserPushTokens(userId: string): Promise<void> {
  await PushToken.deleteMany({ user_id: userId })
}

export interface PushMessage {
  title: string
  body: string
  data?: Record<string, string>
  /** NFR-02: tới cả khi máy tiết kiệm pin */
  urgent?: boolean
}

/** Không throw. Trả số máy FCM nhận */
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
