import { Alert } from '@/models/alert.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { createAlert, OPEN_STATUSES, resolveAlertsForNode } from '@/services/alert.service'
import { publishNodeConfig } from '@/services/deviceConfig.service'
import { CONFIG_MISMATCH_HEARTBEATS } from '@/utils/configSync.util'

/**
 * ENV-FR-027, BR-24 — chạy mỗi phút (jobs/configSync.job.ts). Controller online còn báo phiên bản cũ
 * thì nhận lại cấu hình; controller online đã `MISMATCH` (Report 3 §6.12) có một `CONFIG_MISMATCH`
 * (createAlert gộp lần sau vào cảnh báo đang mở); cảnh báo đóng khi controller không còn `MISMATCH`
 * (đã áp đúng phiên bản, firmware không báo phiên bản, hoặc thiết bị đã gỡ). Controller offline chờ
 * `config` retained khi kết nối lại nên không cần gửi và không bị cảnh báo.
 */
export async function syncControllerConfigs(): Promise<{ republished: number; raised: number; resolved: number }> {
  const behind = await SensorNode.find({ ...IN_SERVICE, status: 'ONLINE', config_sync: { $in: ['PENDING', 'MISMATCH'] } })
    .select('device_id zone_id speaker_schedule audio config_sync applied_config_version').lean()
  const zones = new Map(
    (await Zone.find({ _id: { $in: behind.map(n => n.zone_id) } }).lean()).map(z => [String(z._id), z]),
  )

  let republished = 0
  let raised = 0
  for (const node of behind) {
    const zone = zones.get(String(node.zone_id))
    if (!zone) continue
    if (publishNodeConfig(zone, node)) republished++
    if (node.config_sync !== 'MISMATCH') continue
    const alert = await createAlert({
      farmId: String(zone.farm_id),
      zoneId: String(zone._id),
      nodeId: String(node._id),
      type: 'CONFIG_MISMATCH',
      title: `Cấu hình chưa được áp — ${node.device_id}`,
      message: `${node.device_id} (${zone.name}) vẫn chạy cấu hình cũ sau ${CONFIG_MISMATCH_HEARTBEATS} heartbeat liên tiếp; ` +
        'hệ thống đang gửi lại cấu hình mỗi phút.',
      details: { zone_version: zone.config_version ?? 0, applied_version: node.applied_config_version ?? null },
    })
    if (alert) raised++
  }

  let resolved = 0
  const open = await Alert.find({ type: 'CONFIG_MISMATCH', status: { $in: OPEN_STATUSES } }).select('node_id').lean()
  if (open.length > 0) {
    const stillMismatched = new Set(
      (await SensorNode.find({ _id: { $in: open.map(a => a.node_id) }, ...IN_SERVICE, config_sync: 'MISMATCH' }).select('_id').lean())
        .map(n => String(n._id)),
    )
    for (const nodeId of new Set(open.map(a => String(a.node_id)))) {
      if (!stillMismatched.has(nodeId)) resolved += await resolveAlertsForNode(nodeId, 'Thiết bị đã chạy đúng phiên bản cấu hình', 'CONFIG_MISMATCH')
    }
  }
  return { republished, raised, resolved }
}
