import { randomUUID } from 'crypto'

export type DeviceCommandType = 'RELAY' | 'CLEAR_OVERRIDE' | 'AUDIO' | 'RESTART' | 'OTA'

export const DEVICE_TOPIC_ROOT = 'swiftletcare/dev'

// ID là 1 đoạn topic trong ACL, không được chứa +, # hay /
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]+$/

// MAC của chip ESP32: 12 ký tự hex chữ hoa, như firmware trả ở `SC INFO`
export const CHIP_MAC_PATTERN = /^[0-9A-F]{12}$/

export const DEVICE_UPLINKS = [
  'telemetry', 'telemetry/buffered', 'heartbeat', 'relay/status', 'alert', 'vision/bird-count', 'vision/alert',
] as const
export type DeviceUplink = typeof DEVICE_UPLINKS[number]

export function parseDeviceTopic(topic: string): { deviceId: string; uplink: DeviceUplink } | null {
  const [root, dev, deviceId, ...rest] = topic.split('/')
  const uplink = rest.join('/') as DeviceUplink
  if (`${root}/${dev}` !== DEVICE_TOPIC_ROOT || !deviceId || !DEVICE_UPLINKS.includes(uplink)) return null
  return { deviceId, uplink }
}

// thiết bị áp mỗi commandId 1 lần và bỏ lệnh tới trễ
export function commandEnvelope(type: DeviceCommandType, payload: object) {
  return { commandId: randomUUID(), type, issuedAt: Date.now(), payload }
}
