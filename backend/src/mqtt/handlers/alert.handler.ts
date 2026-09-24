import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { Zone, House } from '@/models/houseZone.model'
import { createAlert } from '@/services/alert.service'
import logger from '@/utils/logger.util'
import type { AlertType, AlertSeverity } from '@/types'

/**
 * alert.handler – nhận cảnh báo do thiết bị tự phát hiện (ESP32: SENSOR_FAULT,
 * RS485_BUS_FAILURE, SPEAKER_FAILURE, PUMP_DRY, POWER_OUTAGE — THREAT-FR-006/
 * 011/012/013; RPi: PREDATOR_DETECTED, BIRD_PANIC — THREAT-FR-001/007) rồi giao
 * cho Alert Engine xử lý dedup/thông báo/socket.
 *
 * Thiết bị được nhận diện qua `deviceId` trong payload, KHÔNG qua slug trong
 * topic (xem ghi chú ở telemetry.service) — nên cảnh báo vẫn vào đúng farm kể
 * cả khi firmware chưa trỏ đúng farmId/houseId/zoneId thật.
 */
export async function handleAlert(topicParts: string[], message: Record<string, unknown>): Promise<void> {
  try {
    const deviceId = message.deviceId as string | undefined
    const type = message.type as AlertType | undefined
    if (!deviceId || !type) {
      logger.warn('alert.handler: payload thiếu deviceId hoặc type', { topicParts, message })
      return
    }

    const node = await SensorNode.findOne({ device_id: deviceId, ...IN_SERVICE })
    if (!node) {
      logger.warn('alert.handler: không tìm thấy thiết bị', { deviceId })
      return
    }
    const zone = await Zone.findById(node.zone_id)
    const house = zone ? await House.findById(zone.house_id) : null
    if (!zone || !house) {
      logger.warn('alert.handler: thiết bị chưa gắn Zone/House hợp lệ', { deviceId })
      return
    }

    await createAlert({
      farmId:      String(house.farm_id),
      zoneId:      String(zone._id),
      nodeId:      String(node._id),
      type,
      severity:    message.severity as AlertSeverity | undefined,
      title:       (message.title as string | undefined) ?? `${type} tại ${zone.name}`,
      message:     (message.message as string | undefined) ?? `Thiết bị ${deviceId} báo ${type}`,
      snapshotUrl: message.snapshotUrl as string | undefined,
      metadata:    { raw: message },
    })
  } catch (err) {
    logger.error('alert.handler: xử lý thất bại', { topicParts, err: (err as Error).message })
  }
}
