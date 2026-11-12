import { Types } from 'mongoose'
import { SensorNode, ISensorNode, IN_SERVICE } from '@/models/device.model'
import { Zone, IZone } from '@/models/houseZone.model'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import { firmwareDetectionConfig, resolveDetectionTuning } from '@/utils/detectionTuning.util'
import { currentConfigVersion } from '@/utils/configSync.util'

const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2))

/**
 * Cấu hình đầy đủ cho 1 ESP32 — key khớp firmware
 * `Config::update()` (firmware/src/config/Config.cpp). Ngưỡng + hệ số logic mờ
 * thuộc Zone, lịch loa ru thuộc từng thiết bị (ENV-FR-006, ENV-FR-021, ENV-FR-013b). Firmware chỉ có 2 khung
 * giờ theo giờ tròn; `windows` rỗng = chưa từng cấu hình → không gửi key khung
 * giờ để firmware giữ mặc định của nó; chỉ 1 khung → khung 2 = 0-0 (không bao giờ khớp).
 */
export function buildDeviceConfig(
  zone: Pick<IZone, 'thresholds' | 'fuzzy_tuning'> & { detection_tuning?: Partial<IZone['detection_tuning']>; config_version?: number },
  node: Pick<ISensorNode, 'speaker_schedule' | 'audio'>,
) {
  const t = zone.thresholds
  const [w1, w2] = node.speaker_schedule.windows
  return {
    temp_min: t.temp_min,
    temp_max: t.temp_max,
    humidity_min: t.humidity_min,
    humidity_max: t.humidity_max,
    light_max: t.light_max,
    nh3_max: t.nh3_max,
    co2_max: t.co2_max,
    ...zone.fuzzy_tuning,
    // EXPERT-FR-008 — 5 tham số phát hiện chạy trên ESP32 (Zone cũ chưa có thì gửi mặc định)
    ...firmwareDetectionConfig(resolveDetectionTuning(zone.detection_tuning)),
    speaker_schedule_enabled: node.speaker_schedule.enabled,
    speaker_volume: node.audio.volume,
    speaker_track: node.audio.current_track,
    ...(w1 && {
      speaker_window1_start_hour: hourOf(w1.start),
      speaker_window1_end_hour: hourOf(w1.end),
      speaker_window2_start_hour: w2 ? hourOf(w2.start) : 0,
      speaker_window2_end_hour: w2 ? hourOf(w2.end) : 0,
    }),
    // ENV-FR-027 — controller báo lại số này trong heartbeat; Zone tạo trước G-08 chưa có số thì là 0
    config_version: zone.config_version ?? 0,
  }
}

type ConfigZone = Parameters<typeof buildDeviceConfig>[0]
type ConfigNode = Pick<ISensorNode, 'device_id' | 'speaker_schedule' | 'audio'>

/** Report 4 §7.2 — `config` retained của 1 thiết bị. false khi backend chưa kết nối broker */
export function publishNodeConfig(zone: ConfigZone, node: ConfigNode): boolean {
  return publishDeviceConfig(node.device_id, { deviceId: node.device_id, ...buildDeviceConfig(zone, node) })
}

/**
 * ENV-FR-027 — mọi lần đổi ngưỡng, hệ số mờ hay tham số phát hiện đều đi qua đây: Zone nhận phiên bản
 * mới, controller đang `APPLIED` về `PENDING` (Report 3 §6.12), rồi mỗi thiết bị của Zone nhận lại bản
 * đầy đủ của nó. Trả false khi có thiết bị chưa gửi được vì backend mất kết nối broker.
 */
export async function publishZoneConfig(zoneId: IZone['_id']): Promise<boolean> {
  const zone = await bumpConfigVersion(zoneId)
  if (!zone) return false
  await SensorNode.updateMany(
    { zone_id: zoneId, ...IN_SERVICE, config_sync: 'APPLIED' },
    { config_sync: 'PENDING', config_stale_heartbeats: 0 },
  )
  const nodes = await SensorNode.find({ zone_id: zoneId, ...IN_SERVICE }).select('device_id speaker_schedule audio').lean()
  return nodes.map(node => publishNodeConfig(zone, node)).every(Boolean)
}

/** Một lần ghi nguyên tử: hai thay đổi cùng lúc trên một Zone không thể ra cùng một phiên bản */
async function bumpConfigVersion(zoneId: IZone['_id']): Promise<IZone | null> {
  return Zone.collection.findOneAndUpdate(
    { _id: new Types.ObjectId(String(zoneId)) },
    [{ $set: { config_version: { $max: [currentConfigVersion(), { $add: [{ $ifNull: ['$config_version', 0] }, 1] }] } } }],
    { returnDocument: 'after' },
  ) as Promise<IZone | null>
}
