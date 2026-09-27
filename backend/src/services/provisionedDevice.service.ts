import crypto from 'crypto'
import { ProvisionedDevice, type ProvisionedDeviceKind } from '@/models/provisionedDevice.model'
import { logAction } from '@/services/auditLog.service'
import { paginate } from '@/utils/helpers.util'
import { BadRequestError, ConflictError } from '@/utils/appError.util'

/** Chuẩn hoá hoa/thường + khoảng trắng: Technician gõ tay từ nhãn dán */
export const hashKey = (key: string) => crypto.createHash('sha256').update(key.trim().toUpperCase()).digest('hex')

/** Bỏ 0/O/1/I/L để Technician đọc nhãn dán ngoài hiện trường không nhầm ký tự */
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Dạng XXXX-XXXX-XXXX (~59 bit) — đủ chống dò, vẫn gõ tay được từ nhãn */
function generateSecretKey(): string {
  const chars = Array.from({ length: 12 }, () => KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)])
  return [0, 4, 8].map(i => chars.slice(i, i + 4).join('')).join('-')
}

/**
 * Admin nhập 1 thiết bị mới vào kho (chuẩn bị xuất xưởng). secretKey bản rõ chỉ
 * trả về ở đây, đúng 1 lần, để in nhãn — backend không lưu lại được nữa.
 */
export async function createProvisionedDevice(
  adminId: string, input: { device_id: string; kind: ProvisionedDeviceKind },
): Promise<{ device_id: string; kind: ProvisionedDeviceKind; secret_key: string }> {
  const deviceId = input.device_id.trim()
  if (await ProvisionedDevice.exists({ device_id: deviceId })) {
    throw ConflictError('device_id đã có trong kho thiết bị')
  }

  const secretKey = generateSecretKey()
  const device = await ProvisionedDevice.create({
    device_id: deviceId, kind: input.kind, secret_key_hash: hashKey(secretKey), created_by: adminId,
  })
  await logAction(adminId, 'DEVICE_PROVISIONED', 'provisioned_device', String(device._id), {
    deviceId, kind: input.kind,
  })
  return { device_id: deviceId, kind: input.kind, secret_key: secretKey }
}

export async function listProvisionedDevices(query: {
  kind?: string; claimed?: string; page?: string | number; limit?: string | number
}) {
  const filter: Record<string, unknown> = {}
  if (query.kind) filter.kind = query.kind
  if (query.claimed === 'true') filter.claimed_at = { $ne: null }
  if (query.claimed === 'false') filter.claimed_at = null

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    ProvisionedDevice.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ProvisionedDevice.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

/**
 * Flow 1 bước 4 / case 3a — xác thực cặp {device_id, secretKey} trên nhãn. Không
 * phân biệt "không có trong kho" với "sai key" để không lộ device_id nào có thật.
 */
export async function verifyActivationKey(deviceId: string, kind: ProvisionedDeviceKind, secretKey: string): Promise<void> {
  const device = await ProvisionedDevice.findOne({ device_id: deviceId, kind }).select('+secret_key_hash').lean()
  const expected = Buffer.from(device?.secret_key_hash ?? hashKey(''), 'hex')
  const actual = Buffer.from(hashKey(secretKey ?? ''), 'hex')
  if (!device || !crypto.timingSafeEqual(expected, actual)) {
    throw BadRequestError('Mã kích hoạt không đúng — kiểm tra lại Device ID và secretKey trên nhãn thiết bị')
  }
}

/** Đánh dấu thiết bị đã được kích hoạt lần đầu (giữ mốc cũ nếu đã có) */
export async function markClaimed(deviceId: string): Promise<void> {
  await ProvisionedDevice.updateOne({ device_id: deviceId, claimed_at: null }, { claimed_at: new Date() })
}
