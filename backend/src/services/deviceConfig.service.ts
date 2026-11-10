import { SensorNode, ISensorNode, IN_SERVICE } from '@/models/device.model'
import { Zone, IZone } from '@/models/houseZone.model'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import { firmwareDetectionConfig, resolveDetectionTuning } from '@/utils/detectionTuning.util'

const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2))

/**
 * Cấu hình đầy đủ cho 1 ESP32 — key khớp firmware
 * `Config::update()` (firmware/src/config/Config.cpp). Ngưỡng + hệ số logic mờ
 * thuộc Zone, lịch loa ru thuộc từng thiết bị (ENV-FR-006, ENV-FR-021, ENV-FR-013b). Firmware chỉ có 2 khung
 * giờ theo giờ tròn; `windows` rỗng = chưa từng cấu hình → không gửi key khung
 * giờ để firmware giữ mặc định của nó; chỉ 1 khung → khung 2 = 0-0 (không bao giờ khớp).
 */
export function buildDeviceConfig(
  zone: Pick<IZone, 'thresholds' | 'fuzzy_tuning'> & { detection_tuning?: Partial<IZone['detection_tuning']> },
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
  }
}

type ConfigZone = Parameters<typeof buildDeviceConfig>[0]
type ConfigNode = Pick<ISensorNode, 'device_id' | 'speaker_schedule' | 'audio'>

/** Report 4 §7.2 — `config` retained của 1 thiết bị. false khi backend chưa kết nối broker */
export function publishNodeConfig(zone: ConfigZone, node: ConfigNode): boolean {
  return publishDeviceConfig(node.device_id, { deviceId: node.device_id, ...buildDeviceConfig(zone, node) })
}

/** Ngưỡng, hệ số, tham số phát hiện thuộc Zone: mỗi thiết bị của Zone nhận lại bản đầy đủ của nó */
export async function publishZoneConfig(zoneId: IZone['_id']): Promise<void> {
  const [zone, nodes] = await Promise.all([
    Zone.findById(zoneId).lean(),
    SensorNode.find({ zone_id: zoneId, ...IN_SERVICE }).select('device_id speaker_schedule audio').lean(),
  ])
  if (zone) nodes.forEach(node => publishNodeConfig(zone, node))
}
