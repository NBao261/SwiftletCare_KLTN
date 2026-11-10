import { randomUUID } from 'crypto'

export type DeviceCommandType = 'RELAY' | 'CLEAR_OVERRIDE' | 'AUDIO' | 'RESTART' | 'OTA'

export const DEVICE_TOPIC_ROOT = 'swiftletcare/dev'

/**
 * NFR-10 d — device ID là username trên broker và là 1 đoạn topic: luật ACL `swiftletcare/dev/${username}/#`
 * (deploy/emqx/acl.conf) chỉ cô lập được thiết bị khi ID không chứa `+`, `#` hay `/` của MQTT: chỉ nhận chữ,
 * số, `_`, `-`.
 */
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]+$/

/** Report 4 §7.2 — đường thiết bị gửi lên, dưới `swiftletcare/dev/{deviceId}/` */
export const DEVICE_UPLINKS = [
  'telemetry', 'telemetry/buffered', 'heartbeat', 'relay/status', 'alert', 'vision/bird-count', 'vision/alert',
] as const
export type DeviceUplink = typeof DEVICE_UPLINKS[number]

/** Topic không đúng cây thiết bị, hoặc đường lạ, thì trả null */
export function parseDeviceTopic(topic: string): { deviceId: string; uplink: DeviceUplink } | null {
  const [root, dev, deviceId, ...rest] = topic.split('/')
  const uplink = rest.join('/') as DeviceUplink
  if (`${root}/${dev}` !== DEVICE_TOPIC_ROOT || !deviceId || !DEVICE_UPLINKS.includes(uplink)) return null
  return { deviceId, uplink }
}

/**
 * Report 4 §7.2, BR-35 — phong bì lệnh: thiết bị áp mỗi `commandId` 1 lần và bỏ lệnh RELAY, AUDIO,
 * RESTART tới trễ. Cấu hình không qua đây: đi trên `config` retained, nhận trễ vẫn vô hại.
 */
export function commandEnvelope(type: DeviceCommandType, payload: object) {
  return { commandId: randomUUID(), type, issuedAt: Date.now(), payload }
}
