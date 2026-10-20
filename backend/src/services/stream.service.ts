import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { CameraNode, IN_SERVICE } from '@/models/device.model'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import {
  BadRequestError, NotFoundError, ServiceUnavailableError, UnauthorizedError,
} from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

/**
 * VISION-FR-013 — xem live stream qua MediaMTX (docs/bird-counting-plan.md §8.6). Video không đi
 * qua backend: mỗi lần có ai đẩy hoặc xem, MediaMTX gọi POST /internal/stream-auth để hỏi quyền.
 *   cam-<device_id>      video đã vẽ khung, pipeline đẩy lên, người dùng xem bằng token
 *   cam-<device_id>-raw  hình gốc từ camera, chỉ pipeline đọc (bằng mật khẩu dịch vụ, plan §18.3)
 */

/** Token sống ngắn: lộ ra (log, lịch sử trình duyệt) cũng hết hạn nhanh; chỉ cần đủ để mở kết nối WHEP */
export const STREAM_TOKEN_TTL_SEC = 60
const RAW_SUFFIX = '-raw'
const STREAM_PATH = /^cam-[A-Za-z0-9_-]+$/

/** Ba biến STREAM_* để trống = chưa dựng máy chủ video: không cấp token, MediaMTX bị từ chối mọi yêu cầu */
function env(name: 'STREAM_TOKEN_SECRET' | 'STREAM_AUTH_KEY' | 'STREAM_PUBLISH_SECRET'): string | undefined {
  return process.env[name] || undefined
}

/** So sánh hằng thời gian: không để lộ khóa qua thời gian phản hồi */
function safeEqual(a: unknown, b: string | undefined): boolean {
  if (typeof a !== 'string' || !b) return false
  const h = (s: string) => crypto.createHash('sha256').update(s).digest()
  return crypto.timingSafeEqual(h(a), h(b))
}

/** VISION-FR-013 — Farm Owner / Domain Expert của farm chứa camera xin token xem stream đã vẽ khung */
export async function issueStreamToken(cameraNodeId: string, user: CurrentUser) {
  const secret = env('STREAM_TOKEN_SECRET')
  if (!secret) throw ServiceUnavailableError('Máy chủ video chưa được cấu hình')

  const node = await CameraNode.findOne({ _id: cameraNodeId, ...IN_SERVICE }).select('device_id zone_id').lean()
  if (!node) throw NotFoundError('Không tìm thấy camera')
  await assertZoneAccess(String(node.zone_id), user)

  const path = `cam-${node.device_id}`
  // device_id "x-raw" sẽ ra đúng tên đường hình gốc của camera "x" (có thể ở farm khác)
  if (!STREAM_PATH.test(path) || path.endsWith(RAW_SUFFIX)) {
    throw BadRequestError('device_id của camera không dùng được làm tên stream (chỉ chữ, số, "-", "_", không kết thúc bằng "-raw")')
  }
  const token = jwt.sign({ path }, secret, { expiresIn: STREAM_TOKEN_TTL_SEC })
  return { path, token, expires_in: STREAM_TOKEN_TTL_SEC }
}

/** Body MediaMTX gửi sang (tài liệu HTTP authentication của MediaMTX 1.21) */
export interface MediaMtxAuthRequest {
  action?: string
  path?: string
  user?: string
  password?: string
  token?: string
  query?: string
}

/** Token có thể tới bằng header `Authorization: Bearer` (→ `token`), `?token=` hoặc ô mật khẩu */
function viewerTokens(body: MediaMtxAuthRequest): string[] {
  const fromQuery = new URLSearchParams(body.query ?? '').get('token')
  return [body.token, fromQuery, body.password].filter((t): t is string => !!t)
}

/** Ném 401 nếu không được phép. MediaMTX coi mọi mã khác 2xx là từ chối. */
export function authorizeStream(key: unknown, body: MediaMtxAuthRequest): void {
  if (!safeEqual(key, env('STREAM_AUTH_KEY'))) throw UnauthorizedError('Sai khóa')

  const path = body.path ?? ''
  if (!STREAM_PATH.test(path)) throw UnauthorizedError('Không được phép')
  const isService = safeEqual(body.password, env('STREAM_PUBLISH_SECRET'))

  // Chỉ pipeline đẩy video lên (và đọc hình gốc để đếm)
  if (body.action === 'publish' && isService) return
  if (body.action === 'read') {
    if (isService) return
    const secret = env('STREAM_TOKEN_SECRET')
    if (secret && !path.endsWith(RAW_SUFFIX)) {
      for (const token of viewerTokens(body)) {
        try {
          const payload = jwt.verify(token, secret) as { path?: string }
          if (payload.path === path) return
        } catch { /* hết hạn hoặc sai chữ ký: thử cách truyền token khác */ }
      }
    }
  }
  // Lần đầu client RTSP chưa gửi mật khẩu: 401 khiến nó gửi lại kèm mật khẩu
  throw UnauthorizedError('Không được phép')
}
