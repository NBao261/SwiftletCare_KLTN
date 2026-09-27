import { randomUUID } from 'crypto'
import { AudioTrack, IAudioTrack } from '@/models/audioTrack.model'
import { SensorNode, ISensorNode } from '@/models/device.model'
import { putObject, removeObject, presignedGetUrl } from '@/config/minio.config'
import { publishCommand } from '@/mqtt/mqtt.client'
import { assertInService, buildDeviceConfig } from '@/services/device.service'
import { logAction } from '@/services/auditLog.service'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { NotFoundError, BadRequestError, ConflictError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

/** SRS §12.4 — giới hạn file upload */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
// Trình duyệt/OS khác nhau báo MIME mp3 khác nhau
const MP3_MIME = ['audio/mpeg', 'audio/mp3']

export interface UploadedFile { buffer: Buffer; mimetype: string; originalname: string; size: number }

const sdName = (n: number) => `${String(n).padStart(4, '0')}.mp3`

async function loadNode(nodeId: string, user: CurrentUser) {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const chain = await assertZoneAccess(String(node.zone_id), user)
  return { node, chain }
}

async function loadTrack(nodeId: string, trackId: string, user: CurrentUser) {
  const ctx = await loadNode(nodeId, user)
  const track = await AudioTrack.findOne({ _id: trackId, node_id: ctx.node._id })
  if (!track) throw NotFoundError('Không tìm thấy bài trong danh mục của thiết bị này')
  return { ...ctx, track }
}

/** ENV-FR-013c(d) — web không ghi được file xuống thẻ SD, nên chỉ chọn/phát bài đã chép tay */
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

/** ENV-FR-013c(a) — Technician/Admin upload bản gốc để lưu danh mục + nghe lại trên web */
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
    // Không để file mồ côi trên MinIO khi ghi DB lỗi (VD 2 người cùng upload 1 số thứ tự)
    await removeObject(fileKey).catch(() => undefined)
    if ((err as { code?: number }).code === 11000) throw duplicate()
    throw err
  }

  await logAction(user._id, 'AUDIO_TRACK_UPLOADED', 'audio_track', String(track._id), {
    nodeId, trackNumber: input.track_number, displayName: input.display_name, sizeBytes: file.size,
  })
  return toDto(track)
}

/** ENV-FR-013c(b) — danh mục bài của thiết bị, kèm URL nghe thử ký tạm 1 giờ */
export async function listTracks(nodeId: string, user: CurrentUser) {
  const { node } = await loadNode(nodeId, user)
  const tracks = await AudioTrack.find({ node_id: node._id }).sort({ track_number: 1 })
  return Promise.all(tracks.map(toDto))
}

/** ENV-FR-013c(a) — Technician tự đánh dấu đã/chưa chép file thật vào thẻ SD */
export async function setSyncStatus(nodeId: string, trackId: string, user: CurrentUser, synced: boolean) {
  const { track } = await loadTrack(nodeId, trackId, user)
  track.synced_to_sd = synced
  await track.save()
  await logAction(user._id, 'AUDIO_TRACK_SYNC_UPDATED', 'audio_track', String(track._id), { nodeId, synced })
  return toDto(track)
}

/** ENV-FR-013c(b) — Farm Owner chọn bài mặc định cho lịch phát (field speaker_track sẵn có ở firmware) */
export async function selectTrack(nodeId: string, trackId: string, user: CurrentUser): Promise<ISensorNode> {
  const { node, chain, track } = await loadTrack(nodeId, trackId, user)
  assertInService(node)
  assertSynced(track)

  node.audio.current_track = track.track_number
  await node.save()
  publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'config/update',
    { deviceId: node.device_id, ...buildDeviceConfig(chain.zone.thresholds, node) })
  await logAction(user._id, 'AUDIO_TRACK_SELECTED', 'sensor_node', String(node._id), {
    trackId, trackNumber: track.track_number, displayName: track.display_name,
  })
  return node
}

/** ENV-FR-013c(c) — phát thử ngay trên loa, bỏ qua lịch (firmware tự dừng sau FORCE_PLAY_MAX_MS) */
export async function playNow(nodeId: string, trackId: string, user: CurrentUser) {
  const { node, chain, track } = await loadTrack(nodeId, trackId, user)
  assertInService(node)
  assertSynced(track)
  assertOnline(node)
  publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'audio/command',
    { deviceId: node.device_id, action: 'play', track: track.track_number })
  return { track_number: track.track_number }
}

/** Dừng phát thử — thiết bị quay về phát theo lịch nếu đang trong khung giờ */
export async function stopPlayback(nodeId: string, user: CurrentUser) {
  const { node, chain } = await loadNode(nodeId, user)
  assertInService(node)
  assertOnline(node)
  publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'audio/command',
    { deviceId: node.device_id, action: 'stop' })
}

/** Xoá khỏi danh mục web — KHÔNG xoá được file vật lý trên thẻ SD */
export async function deleteTrack(nodeId: string, trackId: string, user: CurrentUser) {
  const { track } = await loadTrack(nodeId, trackId, user)
  await track.deleteOne()
  // Bản ghi đã xoá là đủ với người dùng; file MinIO sót lại chỉ tốn dung lượng
  await removeObject(track.file_key).catch((err: Error) =>
    logger.warn('Không xoá được file loa ru trên MinIO', { fileKey: track.file_key, err: err.message }))
  await logAction(user._id, 'AUDIO_TRACK_DELETED', 'audio_track', String(track._id), {
    nodeId, trackNumber: track.track_number, displayName: track.display_name,
  })
}
