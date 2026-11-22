import { randomUUID } from 'crypto'
import { AudioTrack, IAudioTrack } from '@/models/audioTrack.model'
import { SensorNode, ISensorNode } from '@/models/device.model'
import { putObject, removeObject, presignedGetUrl } from '@/config/minio.config'
import { publishDeviceCommand } from '@/mqtt/mqtt.client'
import { publishNodeConfig } from '@/services/deviceConfig.service'
import { assertInService } from '@/services/device.service'
import { logAction } from '@/services/auditLog.service'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { NotFoundError, BadRequestError, ConflictError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
// Trình duyệt/OS báo MIME mp3 khác nhau
const MP3_MIME = ['audio/mpeg', 'audio/mp3']

export interface UploadedFile { buffer: Buffer; mimetype: string; originalname: string; size: number }

const sdName = (n: number) => `${String(n).padStart(4, '0')}.mp3`

async function loadNode(nodeId: string, user: CurrentUser) {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const chain = await assertZoneAccess(String(node.zone_id), user, 'device')
  return { node, chain }
}

async function loadTrack(nodeId: string, trackId: string, user: CurrentUser) {
  const ctx = await loadNode(nodeId, user)
  const track = await AudioTrack.findOne({ _id: trackId, node_id: ctx.node._id })
  if (!track) throw NotFoundError('Không tìm thấy bài trong danh mục của thiết bị này')
  return { ...ctx, track }
}

/** Web không ghi được thẻ SD: chỉ chọn/phát bài đã chép tay */
function assertSynced(track: IAudioTrack) {
  if (!track.synced_to_sd) {
    throw BadRequestError(`Bài "${track.display_name}" chưa được chép vào thẻ SD của thiết bị (${sdName(track.track_number)}) — nhờ kỹ thuật viên chép file và đánh dấu "Đã chép vào thẻ SD" trước`)
  }
}

function assertOnline(node: ISensorNode) {
  if (node.status !== 'ONLINE') throw ConflictError('Thiết bị đang không kết nối — không gửi được lệnh phát')
}

async function toDto(track: IAudioTrack) {
  return { ...track.toObject(), file_url: await presignedGetUrl(track.file_key) }
}

export async function uploadTrack(
  nodeId: string,
  user: CurrentUser,
  input: { file?: UploadedFile; track_number: number; display_name: string },
) {
  const { file } = input
  if (!file) throw BadRequestError('Thiếu file .mp3')
  if (!MP3_MIME.includes(file.mimetype) || !/\.mp3$/i.test(file.originalname)) {
    throw BadRequestError('Chỉ nhận file .mp3 — DFPlayer Mini đọc file 000N.mp3 trên thẻ SD')
  }
  const { node } = await loadNode(nodeId, user)
  // Thiết bị đã gỡ không còn để chép thẻ SD
  assertInService(node)

  const duplicate = () => ConflictError(`Số thứ tự ${input.track_number} (${sdName(input.track_number)}) đã có trong danh mục của thiết bị này`)
  if (await AudioTrack.exists({ node_id: node._id, track_number: input.track_number })) throw duplicate()

  const fileKey = `audio-tracks/${node._id}/${randomUUID()}.mp3`
  await putObject(fileKey, file.buffer, 'audio/mpeg')
  let track: IAudioTrack
  try {
    track = await AudioTrack.create({
      node_id: node._id,
      track_number: input.track_number,
      display_name: input.display_name,
      file_key: fileKey,
      file_size_bytes: file.size,
      uploaded_by: user._id,
    })
  } catch (err) {
    // Không để file mồ côi khi ghi DB lỗi
    await removeObject(fileKey).catch(() => undefined)
    if ((err as { code?: number }).code === 11000) throw duplicate()
    throw err
  }

  await logAction(user._id, 'AUDIO_TRACK_UPLOADED', 'audio_track', String(track._id), {
    nodeId, trackNumber: input.track_number, displayName: input.display_name, sizeBytes: file.size,
  })
  return toDto(track)
}

/** URL ký tạm 1 giờ */
export async function listTracks(nodeId: string, user: CurrentUser) {
  const { node } = await loadNode(nodeId, user)
  const tracks = await AudioTrack.find({ node_id: node._id }).sort({ track_number: 1 })
  return Promise.all(tracks.map(toDto))
}

export async function setSyncStatus(nodeId: string, trackId: string, user: CurrentUser, synced: boolean) {
  const { node, track } = await loadTrack(nodeId, trackId, user)
  assertInService(node)
  track.synced_to_sd = synced
  await track.save()
  await logAction(user._id, 'AUDIO_TRACK_SYNC_UPDATED', 'audio_track', String(track._id), { nodeId, synced })
  return toDto(track)
}

export async function selectTrack(nodeId: string, trackId: string, user: CurrentUser): Promise<ISensorNode> {
  const { node, chain, track } = await loadTrack(nodeId, trackId, user)
  assertInService(node)
  assertSynced(track)

  node.audio.current_track = track.track_number
  await node.save()
  publishNodeConfig(chain.zone, node)
  await logAction(user._id, 'AUDIO_TRACK_SELECTED', 'sensor_node', String(node._id), {
    trackId, trackNumber: track.track_number, displayName: track.display_name,
  })
  return node
}

/** Firmware tự dừng sau FORCE_PLAY_MAX_MS */
export async function playNow(nodeId: string, trackId: string, user: CurrentUser) {
  const { node, track } = await loadTrack(nodeId, trackId, user)
  assertInService(node)
  assertSynced(track)
  assertOnline(node)
  publishDeviceCommand(node.device_id, 'AUDIO', { action: 'play', track: track.track_number })
  return { track_number: track.track_number }
}

export async function stopPlayback(nodeId: string, user: CurrentUser) {
  const { node } = await loadNode(nodeId, user)
  assertInService(node)
  assertOnline(node)
  publishDeviceCommand(node.device_id, 'AUDIO', { action: 'stop' })
}

/** Không xoá được file vật lý trên thẻ SD */
export async function deleteTrack(nodeId: string, trackId: string, user: CurrentUser) {
  const { node, track } = await loadTrack(nodeId, trackId, user)
  // Bài đang chọn và đã trên thẻ: xoá thì thiết bị vẫn phát số đó mà web không biết là bài nào
  if (!node.decommissioned_at && track.synced_to_sd && node.audio.current_track === track.track_number) {
    throw ConflictError(
      `Bài "${track.display_name}" đang được phát theo lịch. Chọn bài khác, hoặc đánh dấu chưa chép vào thẻ SD, rồi mới xoá.`,
    )
  }
  await track.deleteOne()
  // File MinIO sót lại chỉ tốn dung lượng
  await removeObject(track.file_key).catch((err: Error) =>
    logger.warn('Không xoá được file loa ru trên MinIO', { fileKey: track.file_key, err: err.message }))
  await logAction(user._id, 'AUDIO_TRACK_DELETED', 'audio_track', String(track._id), {
    nodeId, trackNumber: track.track_number, displayName: track.display_name,
  })
}
