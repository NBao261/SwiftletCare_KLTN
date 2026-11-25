import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { CameraNode, IN_SERVICE } from '@/models/device.model'
import { verifyBrokerCredential } from '@/services/provisionedDevice.service'
import { assertHouseAccess } from '@/utils/farmAccess.util'
import {
  BadRequestError, NotFoundError, ServiceUnavailableError, UnauthorizedError,
} from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

// Video không đi qua backend. cam-<id>: đã vẽ khung, xem bằng token; cam-<id>-raw: chỉ pipeline đọc

// Ngắn để lộ ra cũng hết hạn nhanh
export const STREAM_TOKEN_TTL_SEC = 60
const RAW_SUFFIX = '-raw'
const STREAM_PATH = /^cam-[A-Za-z0-9_-]+$/

// Để trống = chưa dựng máy chủ video
function env(name: 'STREAM_TOKEN_SECRET' | 'STREAM_AUTH_KEY' | 'STREAM_PUBLISH_SECRET'): string | undefined {
  return process.env[name] || undefined
}

// Hằng thời gian: không lộ khóa qua thời gian phản hồi
function safeEqual(a: unknown, b: string | undefined): boolean {
  if (typeof a !== 'string' || !b) return false
  const h = (s: string) => crypto.createHash('sha256').update(s).digest()
  return crypto.timingSafeEqual(h(a), h(b))
}

export async function issueStreamToken(cameraNodeId: string, user: CurrentUser) {
  const node = await CameraNode.findOne({ _id: cameraNodeId, ...IN_SERVICE }).select('device_id house_id').lean()
  if (!node) throw NotFoundError('Không tìm thấy camera')
  // Quyền trước cấu hình: người không có quyền luôn nhận 403, không phải 503
  await assertHouseAccess(String(node.house_id), user)
  const secret = env('STREAM_TOKEN_SECRET')
  if (!secret) throw ServiceUnavailableError('Máy chủ video chưa được cấu hình')

  const path = `cam-${node.device_id}`
  // "x-raw" trùng tên hình gốc của camera "x"
  if (!STREAM_PATH.test(path) || path.endsWith(RAW_SUFFIX)) {
    throw BadRequestError('device_id của camera không dùng được làm tên stream (chỉ chữ, số, "-", "_", không kết thúc bằng "-raw")')
  }
  const token = jwt.sign({ path }, secret, { expiresIn: STREAM_TOKEN_TTL_SEC })
  return { path, token, expires_in: STREAM_TOKEN_TTL_SEC }
}

export interface MediaMtxAuthRequest {
  action?: string
  path?: string
  user?: string
  password?: string
  token?: string
  query?: string
}

function viewerTokens(body: MediaMtxAuthRequest): string[] {
  const fromQuery = new URLSearchParams(body.query ?? '').get('token')
  return [body.token, fromQuery, body.password].filter((t): t is string => !!t)
}

// Nút AI đăng nhập bằng mã thiết bị và mật khẩu broker của chính nó: chỉ đẩy lên cam-<mã>, cam-<mã>-raw và đọc cam-<mã>-raw.
// Lộ một máy chỉ lộ hình của camera đó, thu hồi mục kho là ngắt luôn hình
async function isOwnCameraNode(body: MediaMtxAuthRequest, path: string): Promise<boolean> {
  const deviceId = body.user
  if (!deviceId || !body.password || (path !== `cam-${deviceId}` && path !== `cam-${deviceId}${RAW_SUFFIX}`)) return false
  if (!(await verifyBrokerCredential(deviceId, body.password))) return false
  return !!(await CameraNode.exists({ device_id: deviceId, ...IN_SERVICE }))
}

// MediaMTX coi mọi mã khác 2xx là từ chối
export async function authorizeStream(key: unknown, body: MediaMtxAuthRequest): Promise<void> {
  if (!safeEqual(key, env('STREAM_AUTH_KEY'))) throw UnauthorizedError('Sai khóa')

  const path = body.path ?? ''
  if (!STREAM_PATH.test(path)) throw UnauthorizedError('Không được phép')
  // STREAM_PUBLISH_SECRET dùng chung: giữ tới khi mọi nút AI đã cài lại bằng mã cài đặt
  const isService = safeEqual(body.password, env('STREAM_PUBLISH_SECRET'))
  const isOwnNode = !isService && await isOwnCameraNode(body, path)
  if (isOwnNode && (body.action === 'publish' || (body.action === 'read' && path.endsWith(RAW_SUFFIX)))) return

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
  // 401 để client RTSP gửi lại kèm mật khẩu
  throw UnauthorizedError('Không được phép')
}
