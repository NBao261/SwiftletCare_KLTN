import crypto from 'crypto'
import { SensorNode, CameraNode, IN_SERVICE } from '@/models/device.model'
import { ProvisionedDevice, type IProvisionedDevice, type ProvisionedDeviceKind } from '@/models/provisionedDevice.model'
import { logAction } from '@/services/auditLog.service'
import { paginate } from '@/utils/helpers.util'
import { CHIP_MAC_PATTERN, DEVICE_ID_PATTERN } from '@/utils/deviceCommand.util'
import { BadRequestError, ConflictError, NotFoundError } from '@/utils/appError.util'

// Gõ tay từ nhãn dán
export const hashKey = (key: string) => crypto.createHash('sha256').update(key.trim().toUpperCase()).digest('hex')

// Bỏ 0/O/1/I/L để đọc nhãn không nhầm
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

// ~59 bit: đủ chống dò, vẫn gõ tay được
function generateSecretKey(): string {
  const chars = Array.from({ length: 12 }, () => KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)])
  return [0, 4, 8].map(i => chars.slice(i, i + 4).join('')).join('-')
}

export const hashBrokerSecret = (secret: string) => crypto.createHash('sha256').update(secret).digest()

// Chỉ máy đọc nên không cần bảng chữ dễ đọc
const generateBrokerSecret = () => crypto.randomBytes(24).toString('base64url')

// Địa chỉ broker thiết bị nối tới, nạp cùng danh tính; trống thì thiết bị dùng địa chỉ biên dịch sẵn
const deviceBrokerHost = (): string | null => process.env.DEVICE_BROKER_HOST?.trim() || null

// secretKey bản rõ chỉ trả về đúng 1 lần để in nhãn
export async function createProvisionedDevice(
  adminId: string, input: { device_id: string; kind: ProvisionedDeviceKind; simulated?: boolean; chip_mac?: string },
): Promise<{
  device_id: string; kind: ProvisionedDeviceKind; simulated: boolean; secret_key: string; broker_secret: string
  broker_host: string | null; chip_mac: string | null
}> {
  const deviceId = input.device_id.trim()
  // Chặn cả ở service (script không qua route): + # / phá cô lập trên broker
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    throw BadRequestError('device_id chỉ gồm chữ, số, `_`, `-`')
  }
  if (await ProvisionedDevice.exists({ device_id: deviceId })) {
    throw ConflictError('device_id đã có trong kho thiết bị')
  }
  const chipMac = input.chip_mac?.trim().toUpperCase() || undefined
  if (chipMac !== undefined) {
    if (!CHIP_MAC_PATTERN.test(chipMac)) throw BadRequestError('MAC của chip phải là 12 ký tự hex')
    const sameChip = await ProvisionedDevice.findOne({ chip_mac: chipMac }).select('device_id revoked_at').lean()
    // Mục đã thu hồi không dùng lại được: nhả MAC để chính bo đó vào kho với mã mới
    if (sameChip?.revoked_at) await ProvisionedDevice.updateOne({ _id: sameChip._id }, { $unset: { chip_mac: '' } })
    else if (sameChip) throw ConflictError(`Bo mạch này đã có trong kho với mã ${sameChip.device_id}. Dùng "Nạp lại" thay vì thêm mới`)
  }

  const secretKey = generateSecretKey()
  const brokerSecret = generateBrokerSecret()
  const simulated = input.simulated === true
  const device = await ProvisionedDevice.create({
    device_id: deviceId, kind: input.kind, simulated, secret_key_hash: hashKey(secretKey),
    broker_secret_hash: hashBrokerSecret(brokerSecret).toString('hex'), created_by: adminId, chip_mac: chipMac,
  })
  await logAction(adminId, 'DEVICE_PROVISIONED', 'provisioned_device', String(device._id), {
    deviceId, kind: input.kind, simulated, ...(chipMac && { chipMac }),
  })
  return {
    device_id: deviceId, kind: input.kind, simulated, secret_key: secretKey, broker_secret: brokerSecret,
    broker_host: deviceBrokerHost(), chip_mac: chipMac ?? null,
  }
}

export type StockStatus = 'IN_STOCK' | 'IN_SERVICE' | 'RELEASED' | 'REVOKED'

type StockRecord = Pick<IProvisionedDevice,
  '_id' | 'device_id' | 'kind' | 'claimed_at' | 'revoked_at' | 'revoke_reason' | 'created_by' | 'created_at' | 'chip_mac'>

export async function listProvisionedDevices(query: {
  kind?: string; claimed?: string; revoked?: string; deviceId?: string; chipMac?: string; page?: string | number; limit?: string | number
}): Promise<{ records: Array<StockRecord & { stock_status: StockStatus }>; total: number; page: number; limit: number }> {
  const filter: Record<string, unknown> = {}
  if (query.kind) filter.kind = query.kind
  if (query.claimed === 'true') filter.claimed_at = { $ne: null }
  if (query.claimed === 'false') filter.claimed_at = null
  if (query.revoked === 'true') filter.revoked_at = { $ne: null }
  if (query.revoked === 'false') filter.revoked_at = null
  // Màn nạp tìm đúng mục kho của bo mạch đang cắm (mã đọc từ chip)
  if (query.deviceId) filter.device_id = query.deviceId
  // Bo đã nạp trước đây mà mất mã (nạp lại toàn bộ chip): nhận ra mục kho qua MAC
  if (query.chipMac) filter.chip_mac = query.chipMac.toUpperCase()

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    ProvisionedDevice.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean<StockRecord[]>(),
    ProvisionedDevice.countDocuments(filter),
  ])

  // Suy ra, không lưu riêng
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

async function isInService(device: { device_id: string; kind: ProvisionedDeviceKind }): Promise<boolean> {
  const Model = device.kind === 'SENSOR' ? SensorNode : CameraNode
  return !!(await Model.exists({ device_id: device.device_id, ...IN_SERVICE }))
}

// Không phân biệt "không có" với "sai key" để không lộ device_id có thật
export async function verifyActivationKey(deviceId: string, kind: ProvisionedDeviceKind, secretKey: string): Promise<{ simulated: boolean }> {
  const device = await ProvisionedDevice.findOne({ device_id: deviceId, kind }).select('+secret_key_hash').lean()
  const expected = Buffer.from(device?.secret_key_hash ?? hashKey(''), 'hex')
  const actual = Buffer.from(hashKey(secretKey ?? ''), 'hex')
  if (!device || !crypto.timingSafeEqual(expected, actual)) {
    throw BadRequestError('Mã kích hoạt không đúng, hãy kiểm tra lại mã thiết bị và mã kích hoạt trên nhãn', 'INVALID_DEVICE_LABEL')
  }
  // Chỉ báo rõ sau khi đúng key
  if (device.revoked_at) {
    throw ConflictError('Thiết bị này đã bị quản trị viên thu hồi nên không kích hoạt được. Hãy liên hệ quản trị viên', 'DEVICE_REVOKED')
  }
  return { simulated: device.simulated === true }
}

async function findProvisionedOrThrow(id: string) {
  const device = await ProvisionedDevice.findById(id)
  if (!device) throw NotFoundError('Không tìm thấy thiết bị trong kho')
  if (device.revoked_at) throw ConflictError('Thiết bị đã bị thu hồi')
  return device
}

// Thiết bị đang chạy phải gỡ trước: thu hồi chỉ chặn kích hoạt, không tắt được thiết bị
export async function revokeProvisionedDevice(adminId: string, id: string, reason: string) {
  const device = await findProvisionedOrThrow(id)
  if (await isInService(device)) {
    throw ConflictError('Thiết bị đang hoạt động ở một trang trại. Gỡ thiết bị trước rồi mới thu hồi')
  }

  device.revoked_at = new Date()
  device.revoke_reason = reason.trim()
  await device.save()
  await logAction(adminId, 'DEVICE_PROVISION_REVOKED', 'provisioned_device', id, {
    deviceId: device.device_id, reason: device.revoke_reason,
  })
  return device
}

// Thiết bị không lưu secretKey nên đổi không làm lệch; đang dùng thì phải gỡ trước
export async function rotateProvisionedKey(adminId: string, id: string) {
  const device = await findProvisionedOrThrow(id)
  if (await isInService(device)) {
    throw ConflictError('Thiết bị đang hoạt động ở một trang trại. Gỡ thiết bị trước rồi mới cấp lại mã kích hoạt')
  }

  const secretKey = generateSecretKey()
  device.secret_key_hash = hashKey(secretKey)
  await device.save()
  await logAction(adminId, 'DEVICE_PROVISION_KEY_ROTATED', 'provisioned_device', id, {
    deviceId: device.device_id, released: !!device.claimed_at,
  })
  return { device_id: device.device_id, kind: device.kind, secret_key: secretKey }
}

// Đổi được cả khi đã kích hoạt nhưng phải flash lại. adminId rỗng khi chạy từ script
export async function rotateBrokerSecret(adminId: string | undefined, id: string) {
  const device = await findProvisionedOrThrow(id)
  const brokerSecret = generateBrokerSecret()
  device.broker_secret_hash = hashBrokerSecret(brokerSecret).toString('hex')
  await device.save()
  await logAction(adminId, 'DEVICE_BROKER_SECRET_ROTATED', 'provisioned_device', id, { deviceId: device.device_id })
  return { device_id: device.device_id, kind: device.kind, broker_secret: brokerSecret, broker_host: deviceBrokerHost() }
}

// Không phân biệt "không có" với "sai mật khẩu": so cả khi thiếu bản ghi, cùng thời gian
export async function verifyBrokerCredential(deviceId: string, secret: string): Promise<boolean> {
  const device = await ProvisionedDevice.findOne({ device_id: deviceId }).select('+broker_secret_hash').lean()
  const expected = device?.broker_secret_hash ? Buffer.from(device.broker_secret_hash, 'hex') : hashBrokerSecret('')
  const matches = crypto.timingSafeEqual(expected, hashBrokerSecret(secret))
  return matches && !!device?.broker_secret_hash && !device.revoked_at
}

// Giữ mốc cũ nếu đã có
export async function markClaimed(deviceId: string): Promise<void> {
  await ProvisionedDevice.updateOne({ device_id: deviceId, claimed_at: null }, { claimed_at: new Date() })
}

// Mã cài đặt nút AI: dùng một lần, hết hạn nhanh, đổi lấy mật khẩu broker mà không ai phải chép mật khẩu
export const SETUP_CODE_TTL_MS = 30 * 60 * 1000

// Gõ tay trên máy nút AI: chữ hoa hay thường, có hay không có dấu "-" đều được
const hashSetupCode = (code: string) =>
  crypto.createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex')

export async function issueSetupCode(adminId: string, id: string) {
  const device = await findProvisionedOrThrow(id)
  if (device.kind !== 'CAMERA') throw BadRequestError('Mã cài đặt chỉ dành cho camera đếm chim (nút AI)')
  const chars = Array.from({ length: 8 }, () => KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)])
  const setupCode = `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
  const expiresAt = new Date(Date.now() + SETUP_CODE_TTL_MS)
  // Mã mới thay mã cũ chưa dùng
  await ProvisionedDevice.updateOne({ _id: device._id }, { setup_code_hash: hashSetupCode(setupCode), setup_code_expires_at: expiresAt })
  await logAction(adminId, 'AI_NODE_SETUP_CODE_ISSUED', 'provisioned_device', id, { deviceId: device.device_id })
  return { device_id: device.device_id, setup_code: setupCode, expires_at: expiresAt }
}

// Địa chỉ đẩy hình kèm tài khoản riêng của nút AI (MediaMTX hỏi /internal/stream-auth)
function streamPublishUrl(deviceId: string, brokerSecret: string): string | null {
  const base = process.env.STREAM_PUBLISH_BASE?.trim()
  if (!base) return null
  const url = new URL(`${base.replace(/\/+$/, '')}/cam-${deviceId}`)
  url.username = deviceId
  url.password = brokerSecret
  return url.toString()
}

// Nút AI đổi mã lấy danh tính: xoá mã và cấp mật khẩu broker mới trong một lần ghi (máy cũ, nếu có, bị ngắt)
export async function enrollWithSetupCode(setupCode: string) {
  const brokerSecret = generateBrokerSecret()
  const device = await ProvisionedDevice.findOneAndUpdate(
    { setup_code_hash: hashSetupCode(setupCode), setup_code_expires_at: { $gt: new Date() }, kind: 'CAMERA', revoked_at: null },
    { $set: { broker_secret_hash: hashBrokerSecret(brokerSecret).toString('hex') }, $unset: { setup_code_hash: '', setup_code_expires_at: '' } },
    { new: true },
  )
  if (!device) throw BadRequestError('Mã cài đặt không đúng hoặc đã hết hạn. Tạo mã mới ở màn Kho thiết bị')
  await logAction(undefined, 'AI_NODE_ENROLLED', 'provisioned_device', String(device._id), { deviceId: device.device_id })
  const host = deviceBrokerHost()
  return {
    device_id: device.device_id,
    broker_secret: brokerSecret,
    // Bản production nối broker qua TLS cổng 8883; trống thì nút AI giữ cấu hình trong config.yaml (máy dev)
    broker: host ? { host, port: 8883, tls: true } : null,
    stream_publish_url: streamPublishUrl(device.device_id, brokerSecret),
  }
}
