import { CameraNode, IN_SERVICE, type ICameraSource } from '@/models/device.model'
import { logAction } from '@/services/auditLog.service'
import { pushCameraConfig } from '@/services/device.service'
import { verifyBrokerCredential } from '@/services/provisionedDevice.service'
import { assertHouseAccess } from '@/utils/farmAccess.util'
import { buildRtspUrl, parseRtspUrl, type CameraSourceFields } from '@/utils/cameraSource.util'
import { decryptSecret, encryptSecret, secretKeyFrom } from '@/utils/secretBox.util'
import { NotFoundError, ServiceUnavailableError, UnauthorizedError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

// Địa chỉ camera IP của một nút AI: Farm Owner nhập trên web, mật khẩu mã hoá, nút AI lấy qua /agent/camera-source

function sourceKey(): Buffer {
  const key = secretKeyFrom(process.env.CAMERA_SOURCE_KEY)
  if (!key) throw ServiceUnavailableError('Máy chủ chưa cấu hình khoá lưu mật khẩu camera (CAMERA_SOURCE_KEY)')
  return key
}

async function findCameraOrThrow(cameraId: string) {
  const camera = await CameraNode.findOne({ _id: cameraId, ...IN_SERVICE }).select('+camera_source.password_encrypted')
  if (!camera) throw NotFoundError('Không tìm thấy camera')
  return camera
}

// Không bao giờ trả mật khẩu, kể cả đã mã hoá
function presentSource(source: ICameraSource | undefined) {
  if (!source) return null
  return {
    host: source.host, port: source.port, username: source.username, path: source.path,
    has_password: !!source.password_encrypted, version: source.version, updated_at: source.updated_at,
  }
}

export async function getCameraSource(user: CurrentUser, cameraId: string) {
  const camera = await findCameraOrThrow(cameraId)
  await assertHouseAccess(String(camera.house_id), user)
  return { camera_status: camera.camera_status ?? null, camera_status_at: camera.camera_status_at ?? null, source: presentSource(camera.camera_source) }
}

// password: không gửi = giữ mật khẩu cũ; chuỗi rỗng = bỏ mật khẩu (camera không đặt mật khẩu)
export interface CameraSourceInput extends CameraSourceFields {
  password?: string
}

export async function updateCameraSource(user: CurrentUser, cameraId: string, input: CameraSourceInput) {
  const camera = await findCameraOrThrow(cameraId)
  await assertHouseAccess(String(camera.house_id), user)
  const previous = camera.camera_source
  const passwordEncrypted = input.password === undefined
    ? previous?.password_encrypted
    : input.password === '' ? undefined : encryptSecret(input.password, sourceKey())

  camera.camera_source = {
    host: input.host, port: input.port, username: input.username, path: input.path,
    password_encrypted: passwordEncrypted, version: (previous?.version ?? 0) + 1, updated_at: new Date(), updated_by: user._id as never,
  }
  await camera.save()
  await logAction(user._id, 'CAMERA_SOURCE_UPDATED', 'camera_node', String(camera._id), {
    deviceId: camera.device_id, host: input.host, port: input.port, username: input.username, path: input.path,
    passwordChanged: input.password !== undefined,
  })
  // Nút AI thấy camera_source_version đổi thì lấy lại địa chỉ; broker chưa nối thì nút AI nhận khi kết nối lại
  await pushCameraConfig(camera).catch((err: Error) => logger.warn('Không gửi được cấu hình camera', { deviceId: camera.device_id, err: err.message }))
  return getCameraSource(user, cameraId)
}

// "Basic base64(mã thiết bị:mật khẩu broker)": cùng tài khoản nút AI dùng với broker
function basicCredentials(authorization: unknown): { deviceId: string; secret: string } | null {
  if (typeof authorization !== 'string' || !authorization.startsWith('Basic ')) return null
  const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
  const colon = decoded.indexOf(':')
  return colon > 0 ? { deviceId: decoded.slice(0, colon), secret: decoded.slice(colon + 1) } : null
}

export async function readSourceForDevice(authorization: unknown) {
  const credentials = basicCredentials(authorization)
  if (!credentials || !(await verifyBrokerCredential(credentials.deviceId, credentials.secret))) {
    throw UnauthorizedError('Sai tài khoản thiết bị')
  }
  const camera = await CameraNode.findOne({ device_id: credentials.deviceId, ...IN_SERVICE }).select('+camera_source.password_encrypted').lean()
  if (!camera) throw NotFoundError('Nút AI chưa được gắn vào nhà yến nào')
  const source = camera.camera_source
  if (!source) return { version: 0, rtsp_url: null }
  const password = source.password_encrypted ? decryptSecret(source.password_encrypted, sourceKey()) : null
  return { version: source.version, rtsp_url: buildRtspUrl(source, password) }
}

// migrate:camera-source — URL chữ thường cũ (rtsp_url) → camera_source mã hoá, rồi xoá trường cũ. Chạy lại an toàn
export async function migrateLegacyRtspUrls(): Promise<{ moved: number; skipped: number }> {
  const cameras = await CameraNode.find({ rtsp_url: { $exists: true } }).select('+rtsp_url +camera_source.password_encrypted')
  let moved = 0
  let skipped = 0
  for (const camera of cameras) {
    const parsed = camera.rtsp_url ? parseRtspUrl(camera.rtsp_url) : null
    // Đã có địa chỉ nhập trên web thì địa chỉ đó thắng; URL hỏng thì bỏ
    if (parsed && !camera.camera_source) {
      camera.camera_source = {
        host: parsed.host, port: parsed.port, username: parsed.username, path: parsed.path,
        password_encrypted: parsed.password ? encryptSecret(parsed.password, sourceKey()) : undefined,
        version: 1, updated_at: new Date(),
      }
      moved++
    } else {
      skipped++
    }
    camera.rtsp_url = undefined
    await camera.save()
  }
  return { moved, skipped }
}
