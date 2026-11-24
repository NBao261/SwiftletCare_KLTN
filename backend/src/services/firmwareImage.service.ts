import crypto from 'crypto'
import { FirmwareImage } from '@/models/firmwareImage.model'
import { getObject, putObject, removeObject } from '@/config/minio.config'
import { logAction } from '@/services/auditLog.service'
import { factoryImageProblem } from '@/utils/firmwareImage.util'
import { BadRequestError, ConflictError, NotFoundError } from '@/utils/appError.util'

// Cũ trước mới sau theo số phiên bản (2.10.0 sau 2.9.0), không theo ngày tải lên
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

export async function uploadFirmwareImage(
  adminId: string, input: { version: string; note?: string }, file: { buffer: Buffer } | undefined,
) {
  if (!file) throw BadRequestError('Chưa chọn file ảnh cài đặt')
  const version = input.version.trim()
  const problem = factoryImageProblem(file.buffer, version)
  if (problem) throw BadRequestError(problem)
  if (await FirmwareImage.exists({ version })) throw ConflictError(`Kho đã có firmware ${version}. Xoá bản cũ trước nếu muốn thay`)

  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const objectKey = `firmware/${version}-${crypto.randomUUID()}.bin`
  await putObject(objectKey, file.buffer, 'application/octet-stream')
  const image = await FirmwareImage.create({
    version, object_key: objectKey, size: file.buffer.length, sha256, note: input.note?.trim() || undefined, uploaded_by: adminId,
  })
  await logAction(adminId, 'FIRMWARE_IMAGE_UPLOADED', 'firmware_image', String(image._id), { version, size: image.size, sha256 })
  return presentImage(image)
}

function presentImage(image: { _id: unknown; version: string; size: number; sha256: string; note?: string; created_at: Date }) {
  return { _id: String(image._id), version: image.version, size: image.size, sha256: image.sha256, note: image.note ?? null, created_at: image.created_at }
}

// Mới nhất trước: trạm nạp lấy phần tử đầu
export async function listFirmwareImages() {
  const images = await FirmwareImage.find().lean()
  return images.sort((a, b) => compareVersions(b.version, a.version)).map(presentImage)
}

export async function getFirmwareImageFile(id: string): Promise<{ buffer: Buffer; version: string; sha256: string }> {
  const image = await FirmwareImage.findById(id).select('+object_key').lean()
  if (!image) throw NotFoundError('Không tìm thấy firmware trong kho')
  return { buffer: await getObject(image.object_key), version: image.version, sha256: image.sha256 }
}

export async function deleteFirmwareImage(adminId: string, id: string): Promise<void> {
  const image = await FirmwareImage.findById(id).select('+object_key')
  if (!image) throw NotFoundError('Không tìm thấy firmware trong kho')
  await image.deleteOne()
  // Xoá file lỗi chỉ để lại file thừa trong bucket
  await removeObject(image.object_key).catch(() => undefined)
  await logAction(adminId, 'FIRMWARE_IMAGE_DELETED', 'firmware_image', id, { version: image.version })
}
