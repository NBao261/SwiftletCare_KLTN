import crypto from 'crypto'
import { Types } from 'mongoose'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { FirmwareImage } from '@/models/firmwareImage.model'
import {
  FirmwareRollout, ROLLOUT_OPEN_STATUSES, TARGET_OPEN_STATES,
  type IFirmwareRollout, type IRolloutTarget, type RolloutTargetState,
} from '@/models/firmwareRollout.model'
import { Zone } from '@/models/houseZone.model'
import { getObject } from '@/config/minio.config'
import { publishDeviceCommand } from '@/mqtt/mqtt.client'
import { logAction } from '@/services/auditLog.service'
import { findRecipients, notifyUser, type UserNotification } from '@/services/notification.service'
import { COMMAND_SUPPORT_SINCE, OTA_CONFIRM_TIMEOUT_MS, appImageOf, versionAtLeast } from '@/utils/firmwareImage.util'
import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'

// Đợt cập nhật firmware từ xa: máy offline chờ trong đợt, nhận lệnh ở heartbeat đầu tiên khi online lại;
// máy thử trước xong thì mới tới các máy còn lại; một máy lỗi thì cả đợt tự dừng

const DOWNLOAD_PATH = '/firmware/ota/'
// cmd.url của firmware là char[256]; token 64 ký tự hex
const MAX_COMMAND_URL = 255
const TOKEN_HEX_LENGTH = 64
// markOtaTimeouts chạy trước trong cùng job; máy SENT mà vẫn quá hạn sau chừng này là máy mất dấu ota_pending
const STUCK_GRACE_MS = 2 * 60 * 1000
// Máy thử trước coi là xong khi đã lên bản mới, đã bị gỡ hoặc bị huỷ
const DONE_OK: RolloutTargetState[] = ['SUCCEEDED', 'SKIPPED', 'CANCELLED']
const HIDDEN_FIELDS = '-targets.token_hash'

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

// Chip chỉ tin chứng chỉ Let's Encrypt và chỉ tải qua HTTPS
function downloadBase(): string {
  const base = (process.env.OTA_DOWNLOAD_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (!base.startsWith('https://')) {
    throw ServiceUnavailableError('Chưa cấu hình địa chỉ HTTPS để thiết bị tải firmware (OTA_DOWNLOAD_BASE_URL)')
  }
  // Link dài hơn firmware nhận thì máy bỏ lệnh và chỉ báo lỗi sau 30 phút
  if (base.length + DOWNLOAD_PATH.length + TOKEN_HEX_LENGTH > MAX_COMMAND_URL) {
    throw ServiceUnavailableError('Địa chỉ tải firmware quá dài, thiết bị chỉ nhận link tối đa 255 ký tự (OTA_DOWNLOAD_BASE_URL)')
  }
  return base
}

async function findRolloutOrThrow(id: string) {
  const rollout = await FirmwareRollout.findById(id).select(HIDDEN_FIELDS)
  if (!rollout) throw NotFoundError('Không tìm thấy đợt cập nhật')
  return rollout
}

export async function listRollouts() {
  return FirmwareRollout.find().select(HIDDEN_FIELDS).sort({ created_at: -1 }).limit(50).lean()
}

const getRollout = (id: unknown) => FirmwareRollout.findById(id).select(HIDDEN_FIELDS).lean()

// Đổi trạng thái một máy chỉ khi nó còn ở trạng thái `from`: heartbeat và job chạy song song không gửi trùng
async function moveTarget(
  rolloutId: unknown, nodeId: unknown, from: RolloutTargetState[], set: Partial<IRolloutTarget>, unset: string[] = [],
  rolloutFilter: Record<string, unknown> = {},
): Promise<boolean> {
  const update: Record<string, unknown> = { $set: Object.fromEntries(Object.entries(set).map(([k, v]) => [`targets.$.${k}`, v])) }
  if (unset.length) update.$unset = Object.fromEntries(unset.map(k => [`targets.$.${k}`, '']))
  const result = await FirmwareRollout.updateOne(
    { _id: rolloutId, ...rolloutFilter, targets: { $elemMatch: { node_id: nodeId, state: { $in: from } } } }, update,
  )
  return result.modifiedCount === 1
}

async function notifyFarmOwners(zoneId: unknown, nodeId: unknown, message: UserNotification): Promise<void> {
  try {
    const zone = await Zone.findById(zoneId).select('farm_id').lean()
    if (!zone) return
    const owners = await findRecipients(String(zone.farm_id))
    await Promise.all(owners.map(o => notifyUser(String(o._id), { ...message, ref: { kind: 'device_action', id: String(nodeId) } })))
  } catch (err) {
    logger.warn('Báo Farm Owner về cập nhật firmware thất bại', { err, nodeId: String(nodeId) })
  }
}

function notifyCreator(rollout: { created_by: unknown }, message: UserNotification): void {
  void notifyUser(String(rollout.created_by), message).catch((err: Error) => logger.warn('Báo người tạo đợt cập nhật thất bại', { err: err.message }))
}

// Gửi lệnh OTA cho một máy đang chờ, nếu máy đang online; link tải dùng riêng cho máy, hết hạn cùng hạn xác nhận
async function sendTarget(rollout: IFirmwareRollout, target: IRolloutTarget, image: { app_sha256: string }, base: string): Promise<void> {
  const node = await SensorNode.findOne({ _id: target.node_id, ...IN_SERVICE })
  if (!node) {
    await moveTarget(rollout._id, target.node_id, ['QUEUED'], { state: 'SKIPPED', reason: 'NOT_IN_SERVICE', finished_at: new Date() })
    return
  }
  // Đã lên bản này bằng cách khác (nạp qua USB)
  if (node.firmware_version === rollout.version) {
    await moveTarget(rollout._id, target.node_id, ['QUEUED'], { state: 'SUCCEEDED', finished_at: new Date() })
    return
  }
  if (node.status !== 'ONLINE') return

  const token = crypto.randomBytes(32).toString('hex')
  const sentAt = new Date()
  const claimed = await moveTarget(rollout._id, node._id, ['QUEUED'], {
    state: 'SENT', sent_at: sentAt, attempts: target.attempts + 1,
    token_hash: hashToken(token), token_expires_at: new Date(sentAt.getTime() + OTA_CONFIRM_TIMEOUT_MS),
  }, [], { status: 'ACTIVE' })
  if (!claimed) return

  const url = `${base}${DOWNLOAD_PATH}${token}`
  if (!publishDeviceCommand(node.device_id, 'OTA', { version: rollout.version, url, sha256: image.app_sha256 })) {
    // Backend mất broker: trả về hàng chờ, job mỗi phút gửi lại
    await moveTarget(rollout._id, node._id, ['SENT'], { state: 'QUEUED', attempts: target.attempts }, ['sent_at', 'token_hash', 'token_expires_at'])
    return
  }

  // Cùng dấu vết như lệnh OTA gửi tay: heartbeat xác nhận, job báo lỗi khi quá hạn. Không lưu link (có token)
  node.ota_pending = { version: rollout.version, url: `${base}${DOWNLOAD_PATH}`, requested_at: sentAt, requested_by: rollout.created_by }
  node.ota_failed = undefined
  await node.save()
  await logAction(String(rollout.created_by), 'DEVICE_COMMAND_SENT', 'sensor_node', String(node._id), {
    deviceId: node.device_id, command: 'OTA', version: rollout.version, rolloutId: String(rollout._id),
  })
  await notifyFarmOwners(node.zone_id, node._id, {
    title: 'Quản trị viên đã cập nhật firmware',
    body: `${node.device_id} đang được cập nhật lên firmware ${rollout.version}.`,
  })
}

// Gửi cho mọi máy tới lượt đang online, rồi chuyển sang lượt sau hoặc kết thúc đợt
export async function dispatchRollout(rolloutId: unknown): Promise<void> {
  const rollout = await FirmwareRollout.findById(rolloutId)
  if (!rollout || rollout.status !== 'ACTIVE') return
  const image = await FirmwareImage.findById(rollout.image_id).select('app_sha256').lean()
  if (!image?.app_sha256) return
  const base = downloadBase()
  for (const target of rollout.targets) {
    if (target.state !== 'QUEUED' || (rollout.stage === 'CANARY' && !target.canary)) continue
    await sendTarget(rollout, target, image, base)
  }
  await advanceRollout(rolloutId)
}

async function advanceRollout(rolloutId: unknown): Promise<void> {
  const rollout = await getRollout(rolloutId)
  if (!rollout || rollout.status !== 'ACTIVE') return
  const canaryDone = rollout.targets.filter(t => t.canary).every(t => DONE_OK.includes(t.state))
  if (rollout.stage === 'CANARY' && canaryDone) {
    const moved = await FirmwareRollout.updateOne({ _id: rollout._id, stage: 'CANARY' }, { stage: 'ALL' })
    if (moved.modifiedCount === 1) return dispatchRollout(rollout._id)
  }
  if (rollout.targets.some(t => TARGET_OPEN_STATES.includes(t.state))) return
  const done = await FirmwareRollout.updateOne({ _id: rollout._id, status: 'ACTIVE' }, { status: 'COMPLETED', finished_at: new Date() })
  if (done.modifiedCount !== 1) return
  const succeeded = rollout.targets.filter(t => t.state === 'SUCCEEDED').length
  notifyCreator(rollout, {
    title: `Đợt cập nhật firmware ${rollout.version} đã xong`,
    body: `${succeeded}/${rollout.targets.length} bộ điều khiển đã chạy firmware ${rollout.version}.`,
  })
}

async function busyNodeIds(nodeIds: unknown[], exceptRolloutId?: unknown): Promise<Set<string>> {
  const rollouts = await FirmwareRollout.find({
    ...(exceptRolloutId ? { _id: { $ne: exceptRolloutId } } : {}),
    status: { $in: ROLLOUT_OPEN_STATUSES },
    targets: { $elemMatch: { node_id: { $in: nodeIds }, state: { $in: TARGET_OPEN_STATES } } },
  }).select('targets.node_id targets.state').lean()
  return new Set(rollouts.flatMap(r => r.targets.filter(t => TARGET_OPEN_STATES.includes(t.state)).map(t => String(t.node_id))))
}

export interface CreateRolloutInput {
  image_id: string
  node_ids: string[]
  canary_node_ids?: string[]
  note?: string
}

export async function createRollout(adminId: string, input: CreateRolloutInput) {
  downloadBase()
  const image = await FirmwareImage.findById(input.image_id).lean()
  if (!image) throw NotFoundError('Không tìm thấy firmware trong kho')
  // Bản tải lên trước khi có cập nhật từ xa không có mã kiểm của phần firmware
  if (!image.app_sha256) throw ConflictError(`Firmware ${image.version} cần tải lên lại trước khi cập nhật từ xa. Xoá bản này rồi tải lại file`)

  const nodeIds = [...new Set(input.node_ids)]
  const canaryIds = new Set(input.canary_node_ids ?? [])
  if ([...canaryIds].some(id => !nodeIds.includes(id))) throw BadRequestError('Máy thử trước phải nằm trong các máy được chọn')

  const nodes = await SensorNode.find({ _id: { $in: nodeIds }, ...IN_SERVICE }).lean()
  if (nodes.length !== nodeIds.length) throw BadRequestError('Có bộ điều khiển không còn dùng. Tải lại danh sách rồi chọn lại')

  const busy = await busyNodeIds(nodeIds)

  const problems = nodes.flatMap(node => {
    if (!versionAtLeast(node.firmware_version, COMMAND_SUPPORT_SINCE)) return [`${node.device_id} chạy firmware quá cũ, cần nạp qua USB`]
    if (node.firmware_version === image.version) return [`${node.device_id} đã chạy firmware ${image.version}`]
    if (node.ota_pending || busy.has(String(node._id))) return [`${node.device_id} đang có một lần cập nhật chưa xong`]
    return []
  })
  if (problems.length) throw ConflictError(`Không tạo được đợt cập nhật: ${problems.join('; ')}`)

  const rollout = await FirmwareRollout.create({
    image_id: image._id, version: image.version, note: input.note?.trim() || undefined, created_by: adminId,
    stage: canaryIds.size ? 'CANARY' : 'ALL',
    targets: nodes.map(node => ({
      node_id: node._id, device_id: node.device_id, from_version: node.firmware_version, canary: canaryIds.has(String(node._id)),
    })),
  })
  await logAction(adminId, 'FIRMWARE_ROLLOUT_CREATED', 'firmware_rollout', String(rollout._id), {
    version: image.version, devices: nodes.length, canary: canaryIds.size,
  })
  await dispatchRollout(rollout._id)
  return getRollout(rollout._id)
}

type RolloutAction = 'pause' | 'resume' | 'promote' | 'cancel'

const OPEN = { $in: ROLLOUT_OPEN_STATUSES }
const CHANGED_MEANWHILE = 'Đợt cập nhật vừa thay đổi. Tải lại trang rồi thử lại'

// Mỗi thao tác là một cập nhật có điều kiện: heartbeat hay job chạy cùng lúc không bị ghi đè
const ACTIONS: Record<RolloutAction, { filter: Record<string, unknown>; update: () => Record<string, unknown> }> = {
  pause: { filter: { status: 'ACTIVE' }, update: () => ({ $set: { status: 'PAUSED', paused_reason: 'ADMIN' } }) },
  resume: { filter: { status: 'PAUSED' }, update: () => ({ $set: { status: 'ACTIVE' }, $unset: { paused_reason: '' } }) },
  promote: { filter: { status: OPEN, stage: 'CANARY' }, update: () => ({ $set: { stage: 'ALL' } }) },
  cancel: { filter: { status: OPEN }, update: () => ({ $set: { status: 'CANCELLED', finished_at: new Date() }, $unset: { paused_reason: '' } }) },
}

function refusal(rollout: Pick<IFirmwareRollout, 'status' | 'stage'>, action: RolloutAction): string {
  if (!ROLLOUT_OPEN_STATUSES.includes(rollout.status)) return 'Đợt cập nhật đã kết thúc'
  if (action === 'pause' && rollout.status === 'PAUSED') return 'Đợt cập nhật đang tạm dừng'
  if (action === 'resume' && rollout.status === 'ACTIVE') return 'Đợt cập nhật đang chạy'
  if (action === 'promote' && rollout.stage === 'ALL') return 'Đợt cập nhật đã gửi cho mọi máy'
  return CHANGED_MEANWHILE
}

export async function changeRollout(adminId: string, id: string, action: RolloutAction) {
  const rollout = await findRolloutOrThrow(id)
  const { filter, update } = ACTIONS[action]
  const changed = await FirmwareRollout.updateOne({ _id: rollout._id, ...filter }, update())
  if (changed.modifiedCount !== 1) throw ConflictError(refusal(rollout, action))
  // Huỷ: đợt đã CANCELLED nên không máy nào được nhận thêm; máy còn chờ ghi huỷ, máy đang tải vẫn ghi kết quả
  if (action === 'cancel') {
    await FirmwareRollout.updateOne(
      { _id: rollout._id },
      { $set: { 'targets.$[t].state': 'CANCELLED', 'targets.$[t].finished_at': new Date() } },
      { arrayFilters: [{ 't.state': 'QUEUED' }] },
    )
  }
  await logAction(adminId, `FIRMWARE_ROLLOUT_${action.toUpperCase()}`, 'firmware_rollout', id, { version: rollout.version })
  await dispatchRollout(rollout._id)
  return getRollout(rollout._id)
}

export async function retryTarget(adminId: string, id: string, nodeId: string) {
  const rollout = await findRolloutOrThrow(id)
  if (rollout.status === 'CANCELLED') throw ConflictError('Đợt cập nhật đã huỷ')
  const target = rollout.targets.find(t => String(t.node_id) === nodeId)
  if (!target) throw NotFoundError('Bộ điều khiển không nằm trong đợt cập nhật này')
  if (target.state !== 'FAILED') throw ConflictError('Chỉ thử lại được máy cập nhật lỗi')
  // Cùng điều kiện khi tạo đợt: một máy chỉ ở một lần cập nhật chưa xong
  const node = await SensorNode.findById(target.node_id).select('ota_pending').lean()
  if (node?.ota_pending || (await busyNodeIds([target.node_id], rollout._id)).has(nodeId)) {
    throw ConflictError(`${target.device_id} đang có một lần cập nhật chưa xong ở đợt khác`)
  }
  const image = await FirmwareImage.findById(rollout.image_id).select('app_sha256').lean()
  if (!image?.app_sha256) throw ConflictError(`Firmware ${rollout.version} không còn trong kho. Tạo đợt mới với bản khác`)

  const moved = await moveTarget(rollout._id, target.node_id, ['FAILED'], { state: 'QUEUED' }, ['reason', 'finished_at'],
    { status: { $ne: 'CANCELLED' } })
  if (!moved) throw ConflictError(CHANGED_MEANWHILE)
  // Thử lại là muốn đợt chạy tiếp; đợt do Administrator tự dừng thì vẫn dừng
  await FirmwareRollout.updateOne(
    { _id: rollout._id, $or: [{ status: 'COMPLETED' }, { status: 'PAUSED', paused_reason: 'FAILURE' }] },
    { $set: { status: 'ACTIVE' }, $unset: { paused_reason: '', finished_at: '' } },
  )
  await logAction(adminId, 'FIRMWARE_ROLLOUT_RETRY', 'firmware_rollout', id, { version: rollout.version, deviceId: target.device_id })
  await dispatchRollout(rollout._id)
  return getRollout(rollout._id)
}

// Heartbeat của bộ điều khiển: máy đã lên bản mới thì ghi xong; máy đang chờ mà online thì gửi lệnh
export async function onControllerHeartbeat(nodeId: Types.ObjectId, firmwareVersion: string | undefined): Promise<void> {
  const rollouts = await FirmwareRollout.find({
    targets: { $elemMatch: { node_id: nodeId, state: { $in: TARGET_OPEN_STATES } } },
  }).select('_id version status targets.node_id targets.state').lean()
  for (const rollout of rollouts) {
    const target = rollout.targets.find(t => String(t.node_id) === String(nodeId))
    if (target?.state === 'SENT' && firmwareVersion === rollout.version) {
      await moveTarget(rollout._id, nodeId, ['SENT'], { state: 'SUCCEEDED', finished_at: new Date() }, ['token_hash'])
      await advanceRollout(rollout._id)
    } else if (target?.state === 'QUEUED' && rollout.status === 'ACTIVE') {
      await dispatchRollout(rollout._id)
    }
  }
}

// Job OTA báo một máy quá hạn xác nhận. true = máy thuộc một đợt, đợt đã báo người tạo
export async function onOtaTimedOut(nodeId: Types.ObjectId, version: string, runningVersion: string): Promise<boolean> {
  const rollout = await FirmwareRollout.findOne({ version, targets: { $elemMatch: { node_id: nodeId, state: 'SENT' } } })
    .select('_id version status created_by targets.node_id targets.device_id').lean()
  if (!rollout) return false
  await moveTarget(rollout._id, nodeId, ['SENT'], { state: 'FAILED', reason: 'TIMEOUT', finished_at: new Date() }, ['token_hash'])
  const paused = await FirmwareRollout.updateOne({ _id: rollout._id, status: 'ACTIVE' }, { status: 'PAUSED', paused_reason: 'FAILURE' })
  const deviceId = rollout.targets.find(t => String(t.node_id) === String(nodeId))?.device_id ?? ''
  notifyCreator(rollout, {
    title: paused.modifiedCount === 1 ? `Đợt cập nhật firmware ${version} đã tạm dừng` : 'Cập nhật firmware không thành công',
    body: `${deviceId} vẫn chạy ${runningVersion} sau 30 phút, có thể đã quay về bản cũ.` +
      (paused.modifiedCount === 1 ? ' Các máy còn lại chưa được gửi. Kiểm tra rồi tiếp tục hoặc huỷ đợt.' : ''),
  })
  return true
}

// Job mỗi phút: bỏ máy đã gỡ giữa chừng, ghi lỗi máy SENT quá hạn mà job OTA không thấy (mất ota_pending),
// rồi gửi cho máy online mà heartbeat chưa kịp gửi (backend vừa mất broker)
export async function sweepRollouts(): Promise<void> {
  const stuckBefore = new Date(Date.now() - OTA_CONFIRM_TIMEOUT_MS - STUCK_GRACE_MS)
  const withSent = await FirmwareRollout.find({ 'targets.state': 'SENT' })
    .select('_id version targets.node_id targets.state targets.sent_at').lean()
  for (const rollout of withSent) {
    const sent = rollout.targets.filter(t => t.state === 'SENT')
    const nodes = new Map((await SensorNode.find({ _id: { $in: sent.map(t => t.node_id) }, ...IN_SERVICE })
      .select('_id firmware_version').lean()).map(n => [String(n._id), n]))
    for (const target of sent) {
      const node = nodes.get(String(target.node_id))
      if (!node) {
        await moveTarget(rollout._id, target.node_id, ['SENT'], { state: 'SKIPPED', reason: 'NOT_IN_SERVICE', finished_at: new Date() }, ['token_hash'])
      } else if (target.sent_at && target.sent_at < stuckBefore) {
        await onOtaTimedOut(node._id, rollout.version, node.firmware_version)
      }
    }
  }
  for (const rollout of await FirmwareRollout.find({ status: 'ACTIVE' }).select('_id').lean()) await dispatchRollout(rollout._id)
}

// Lệnh OTA gửi tay không được chen vào máy đang trong một đợt
export async function assertNotInRollout(nodeId: unknown): Promise<void> {
  const inRollout = await FirmwareRollout.exists({
    status: { $in: ROLLOUT_OPEN_STATUSES }, targets: { $elemMatch: { node_id: nodeId, state: { $in: TARGET_OPEN_STATES } } },
  })
  if (inRollout) throw ConflictError('Thiết bị đang trong một đợt cập nhật firmware. Cập nhật ở trang Cập nhật firmware')
}

// Link tải của máy: chỉ phần firmware, kèm độ dài để chip biết đã tải đủ
export async function readOtaDownload(token: string): Promise<Buffer> {
  const rollout = await FirmwareRollout.findOne({
    targets: { $elemMatch: { token_hash: hashToken(token), state: 'SENT', token_expires_at: { $gt: new Date() } } },
  }).select('image_id').lean()
  if (!rollout) throw NotFoundError('Link tải firmware không hợp lệ hoặc đã hết hạn')
  const image = await FirmwareImage.findById(rollout.image_id).select('+object_key').lean()
  if (!image) throw NotFoundError('Không tìm thấy firmware trong kho')
  return appImageOf(await getObject(image.object_key))
}
