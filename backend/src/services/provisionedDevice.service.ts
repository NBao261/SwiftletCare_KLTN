import crypto from 'crypto'
import { SensorNode, CameraNode, IN_SERVICE } from '@/models/device.model'
import { ProvisionedDevice, type IProvisionedDevice, type ProvisionedDeviceKind } from '@/models/provisionedDevice.model'
import { logAction } from '@/services/auditLog.service'
import { paginate } from '@/utils/helpers.util'
import { DEVICE_ID_PATTERN } from '@/utils/deviceCommand.util'
import { BadRequestError, ConflictError, NotFoundError } from '@/utils/appError.util'

/** Chuẩn hoá hoa/thường + khoảng trắng: Technician gõ tay từ nhãn dán */
export const hashKey = (key: string) => crypto.createHash('sha256').update(key.trim().toUpperCase()).digest('hex')

/** Bỏ 0/O/1/I/L để Technician đọc nhãn dán ngoài hiện trường không nhầm ký tự */
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Dạng XXXX-XXXX-XXXX (~59 bit) — đủ chống dò, vẫn gõ tay được từ nhãn */
function generateSecretKey(): string {
  const chars = Array.from({ length: 12 }, () => KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)])
  return [0, 4, 8].map(i => chars.slice(i, i + 4).join('')).join('-')
}

export const hashBrokerSecret = (secret: string) => crypto.createHash('sha256').update(secret).digest()

/** FARM-FR-010 — chuỗi ngẫu nhiên dài, chỉ máy đọc, nên không cần bảng chữ dễ đọc như activation key */
const generateBrokerSecret = () => crypto.randomBytes(24).toString('base64url')

/**
 * Admin nhập 1 thiết bị mới vào kho (chuẩn bị xuất xưởng). secretKey bản rõ chỉ
 * trả về ở đây, đúng 1 lần, để in nhãn — backend không lưu lại được nữa.
 */
export async function createProvisionedDevice(
  adminId: string, input: { device_id: string; kind: ProvisionedDeviceKind; simulated?: boolean },
): Promise<{ device_id: string; kind: ProvisionedDeviceKind; simulated: boolean; secret_key: string; broker_secret: string }> {
  const deviceId = input.device_id.trim()
  // Chặn cả ở service (script nhập kho không qua route): ID có `+`, `#`, `/` phá cô lập trên broker
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    throw BadRequestError('device_id chỉ gồm chữ, số, `_`, `-`')
  }
  if (await ProvisionedDevice.exists({ device_id: deviceId })) {
    throw ConflictError('device_id đã có trong kho thiết bị')
  }

  const secretKey = generateSecretKey()
  const brokerSecret = generateBrokerSecret()
  const simulated = input.simulated === true
  const device = await ProvisionedDevice.create({
    device_id: deviceId, kind: input.kind, simulated, secret_key_hash: hashKey(secretKey),
    broker_secret_hash: hashBrokerSecret(brokerSecret).toString('hex'), created_by: adminId,
  })
  await logAction(adminId, 'DEVICE_PROVISIONED', 'provisioned_device', String(device._id), {
    deviceId, kind: input.kind, simulated,
  })
  return { device_id: deviceId, kind: input.kind, simulated, secret_key: secretKey, broker_secret: brokerSecret }
}

/** Report 3 §6.16 — trạng thái nhãn của 1 thiết bị trong kho */
export type StockStatus = 'IN_STOCK' | 'IN_SERVICE' | 'RELEASED' | 'REVOKED'

type StockRecord = Pick<IProvisionedDevice,
  '_id' | 'device_id' | 'kind' | 'claimed_at' | 'revoked_at' | 'revoke_reason' | 'created_by' | 'created_at'>

export async function listProvisionedDevices(query: {
  kind?: string; claimed?: string; revoked?: string; page?: string | number; limit?: string | number
}): Promise<{ records: Array<StockRecord & { stock_status: StockStatus }>; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {}
  if (query.kind) filter.kind = query.kind
  if (query.claimed === 'true') filter.claimed_at = { $ne: null }
  if (query.claimed === 'false') filter.claimed_at = null
  if (query.revoked === 'true') filter.revoked_at = { $ne: null }
  if (query.revoked === 'false') filter.revoked_at = null

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    ProvisionedDevice.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean<StockRecord[]>(),
    ProvisionedDevice.countDocuments(filter),
  ])

  // Report 3 §6.16 — trạng thái nhãn suy ra từ kho + thiết bị đang dùng, không lưu riêng
  const idsOf = (kind: ProvisionedDeviceKind) => records.filter(r => r.kind === kind).map(r => r.device_id)
  const [sensors, cameras] = await Promise.all([
    SensorNode.find({ device_id: { $in: idsOf('SENSOR') }, ...IN_SERVICE }).select('device_id').lean(),
    CameraNode.find({ device_id: { $in: idsOf('CAMERA') }, ...IN_SERVICE }).select('device_id').lean(),
  ])
  const inService = new Set([...sensors, ...cameras].map(d => d.device_id))
  const stockStatus = (r: StockRecord): StockStatus =>
    r.revoked_at ? 'REVOKED' : inService.has(r.device_id) ? 'IN_SERVICE' : r.claimed_at ? 'RELEASED' : 'IN_STOCK'

  return { records: records.map(r => ({ ...r, stock_status: stockStatus(r) })), total, page, limit }
}

/** Thiết bị đang dùng ở một farm (chưa gỡ, FARM-FR-008) */
async function isInService(device: { device_id: string; kind: ProvisionedDeviceKind }): Promise<boolean> {
  const Model = device.kind === 'SENSOR' ? SensorNode : CameraNode
  return !!(await Model.exists({ device_id: device.device_id, ...IN_SERVICE }))
}

/**
 * Flow 1 bước 4 / case 3a — xác thực cặp {device_id, secretKey} trên nhãn. Không
 * phân biệt "không có trong kho" với "sai key" để không lộ device_id nào có thật.
 */
/** Trả cờ `simulated` của mục kho để thiết bị đăng ký mang theo (SYSTEM-FR-004) */
export async function verifyActivationKey(deviceId: string, kind: ProvisionedDeviceKind, secretKey: string): Promise<{ simulated: boolean }> {
  const device = await ProvisionedDevice.findOne({ device_id: deviceId, kind }).select('+secret_key_hash').lean()
  const expected = Buffer.from(device?.secret_key_hash ?? hashKey(''), 'hex')
  const actual = Buffer.from(hashKey(secretKey ?? ''), 'hex')
  if (!device || !crypto.timingSafeEqual(expected, actual)) {
    throw BadRequestError('Mã kích hoạt không đúng — kiểm tra lại Device ID và secretKey trên nhãn thiết bị')
  }
  // Báo rõ chỉ SAU khi đúng key: người chỉ biết device_id không dò được thiết bị nào bị thu hồi
  if (device.revoked_at) {
    throw ConflictError('Thiết bị này đã bị Administrator thu hồi, không kích hoạt được — liên hệ Administrator')
  }
  return { simulated: device.simulated === true }
}

async function findProvisionedOrThrow(id: string) {
  const device = await ProvisionedDevice.findById(id)
  if (!device) throw NotFoundError('Không tìm thấy thiết bị trong kho')
  if (device.revoked_at) throw ConflictError('Thiết bị đã bị thu hồi')
  return device
}

/**
 * Thu hồi thiết bị trong kho (mất/lộ nhãn, hàng lỗi). Thiết bị đang chạy ngoài farm
 * phải được gỡ (FARM-FR-008) trước — thu hồi không tắt được thiết bị đang hoạt động
 * mà chỉ chặn kích hoạt, nên để Admin tưởng đã "tắt" nó là sai.
 */
export async function revokeProvisionedDevice(adminId: string, id: string, reason: string) {
  const device = await findProvisionedOrThrow(id)
  if (await isInService(device)) {
    throw ConflictError('Thiết bị đang hoạt động ở một farm — gỡ thiết bị trước rồi mới thu hồi')
  }

  device.revoked_at = new Date()
  device.revoke_reason = reason.trim()
  await device.save()
  await logAction(adminId, 'DEVICE_PROVISION_REVOKED', 'provisioned_device', id, {
    deviceId: device.device_id, reason: device.revoke_reason,
  })
  return device
}

/**
 * FARM-FR-010, BR-26 — cấp secretKey mới (in lại nhãn) khi nhãn bị mất hoặc lộ, cho thiết bị
 * không đang dùng ở farm nào: còn trong kho (IN_STOCK) hoặc đã gỡ khỏi farm (RELEASED, Report 3
 * §6.16). Thiết bị không lưu secretKey nên đổi ở backend không làm thiết bị lệch; nhãn cũ bị từ
 * chối ngay. Thiết bị đang dùng thì phải gỡ trước, để không ai chiếm được thiết bị đang chạy.
 */
export async function rotateProvisionedKey(adminId: string, id: string) {
  const device = await findProvisionedOrThrow(id)
  if (await isInService(device)) {
    throw ConflictError('Thiết bị đang hoạt động ở một farm — gỡ thiết bị trước rồi mới cấp lại key')
  }

  const secretKey = generateSecretKey()
  device.secret_key_hash = hashKey(secretKey)
  await device.save()
  await logAction(adminId, 'DEVICE_PROVISION_KEY_ROTATED', 'provisioned_device', id, {
    deviceId: device.device_id, released: !!device.claimed_at,
  })
  return { device_id: device.device_id, kind: device.kind, secret_key: secretKey }
}

/**
 * FARM-FR-010 — cấp mật khẩu broker mới (bị lộ, hoặc thiết bị nhập kho trước G-07). Khác activation
 * key, đổi được cả khi thiết bị đã kích hoạt, nhưng phải flash lại mật khẩu vào thiết bị.
 * `adminId` rỗng khi chạy từ script dòng lệnh.
 */
export async function rotateBrokerSecret(adminId: string | undefined, id: string) {
  const device = await findProvisionedOrThrow(id)
  const brokerSecret = generateBrokerSecret()
  device.broker_secret_hash = hashBrokerSecret(brokerSecret).toString('hex')
  await device.save()
  await logAction(adminId, 'DEVICE_BROKER_SECRET_ROTATED', 'provisioned_device', id, { deviceId: device.device_id })
  return { device_id: device.device_id, kind: device.kind, broker_secret: brokerSecret }
}

/**
 * Report 4 §7.2 — EMQX hỏi tài khoản này có được nối không: device ID + broker secret trong kho, chưa thu
 * hồi. Không phân biệt "không có trong kho" với "sai mật khẩu" (so cả khi thiếu bản ghi, cùng thời gian).
 */
export async function verifyBrokerCredential(deviceId: string, secret: string): Promise<boolean> {
  const device = await ProvisionedDevice.findOne({ device_id: deviceId }).select('+broker_secret_hash').lean()
  const expected = device?.broker_secret_hash ? Buffer.from(device.broker_secret_hash, 'hex') : hashBrokerSecret('')
  const matches = crypto.timingSafeEqual(expected, hashBrokerSecret(secret))
  return matches && !!device?.broker_secret_hash && !device.revoked_at
}

/** Đánh dấu thiết bị đã được kích hoạt lần đầu (giữ mốc cũ nếu đã có) */
export async function markClaimed(deviceId: string): Promise<void> {
  await ProvisionedDevice.updateOne({ device_id: deviceId, claimed_at: null }, { claimed_at: new Date() })
}
