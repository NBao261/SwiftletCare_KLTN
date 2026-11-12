import mqtt, { MqttClient } from 'mqtt'
import fs from 'fs'
import { commandEnvelope, DEVICE_TOPIC_ROOT, DEVICE_UPLINKS, parseDeviceTopic } from '@/utils/deviceCommand.util'
import type { DeviceCommandType, DeviceUplink } from '@/utils/deviceCommand.util'
import logger from '@/utils/logger.util'
import { handleTelemetry }   from '@/mqtt/handlers/telemetry.handler'
import { handleHeartbeat }   from '@/mqtt/handlers/heartbeat.handler'
import { handleAlert }       from '@/mqtt/handlers/alert.handler'
import { handleBirdCount }   from '@/mqtt/handlers/birdCount.handler'
import { handleRelayStatus } from '@/mqtt/handlers/relayStatus.handler'

let client: MqttClient | null = null

// Report 4 §7.2 — mỗi thiết bị một cây topic; farm, house, zone tra từ bản ghi thiết bị (D3)
const HANDLERS: Record<DeviceUplink, (topicParts: string[], message: Record<string, unknown>) => Promise<void>> = {
  telemetry: handleTelemetry,             // ENV-FR-001
  'telemetry/buffered': handleTelemetry,  // ENV-FR-024 — mẫu buffer mang timestamp gốc
  heartbeat: handleHeartbeat,             // FARM-FR-005, THREAT-FR-010 (nút AI)
  'relay/status': handleRelayStatus,      // ENV-FR-015
  alert: handleAlert,                     // THREAT-FR-006/011/012/013
  'vision/alert': handleAlert,            // EDGE_AI_DEGRADED của nút AI
  'vision/bird-count': handleBirdCount,   // VISION-FR-006
}

export function connectMQTT(): void {
  // EMQX hỏi /internal/mqtt-auth cho mọi kết nối, kể cả của backend: thiếu khoá thì chỉ thấy 401 lặp mỗi giây
  if (!process.env.MQTT_AUTH_KEY) {
    logger.error('Thiếu MQTT_AUTH_KEY: EMQX sẽ từ chối mọi kết nối, kể cả backend (MQTT code 5). '
      + 'Đặt cùng giá trị với khoá EMQX gửi kèm /internal/mqtt-auth (docker-compose.yml, mặc định CHANGE_ME)')
  }
  const caPath = process.env.MQTT_CA_CERT_PATH ?? ''
  const options: mqtt.IClientOptions = {
    // Phiên bền: lệnh và tin QoS 1 của thiết bị không mất trong lúc backend khởi động lại
    clientId: process.env.MQTT_CLIENT_ID ?? 'swiftletcare-backend',
    clean: false,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    ...(fs.existsSync(caPath) && {
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    }),
  }

  client = mqtt.connect(process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883', options)

  client.on('connect', () => {
    logger.info('MQTT broker connected')
    DEVICE_UPLINKS.forEach(uplink => client!.subscribe(`${DEVICE_TOPIC_ROOT}/+/${uplink}`, { qos: 1 }))
  })

  client.on('message', (topic: string, payload: Buffer, packet: mqtt.IPublishPacket) => {
    routeDeviceMessage(topic, payload, packet.retain)
  })

  client.on('error',   (err: Error) => logger.error('MQTT error', { err }))
  client.on('offline', () => logger.warn('MQTT offline – reconnecting...'))
}

/**
 * Report 4 §7.2 — tin thiết bị gửi lên. Không ingest tin retained: đó là tin cũ broker phát lại mỗi lần
 * backend (re)connect, kể cả khi thiết bị đã chết. `deviceId` khác topic thì bỏ: thiết bị chỉ được nói
 * thay chính nó (broker đã chặn phần topic, phần thân tin chỉ backend kiểm được).
 */
export function routeDeviceMessage(topic: string, payload: Buffer, retained: boolean): void {
  if (retained) return
  const parsed = parseDeviceTopic(topic)
  if (!parsed) return
  try {
    const message = JSON.parse(payload.toString()) as Record<string, unknown>
    if (message.deviceId !== parsed.deviceId) {
      logger.warn('Bỏ tin MQTT: deviceId trong tin khác topic', { topic, deviceId: message.deviceId })
      return
    }
    void HANDLERS[parsed.uplink](topic.split('/'), message)
  } catch (err) {
    logger.error('MQTT message parse error', { err })
  }
}

/**
 * Trả về false khi lệnh KHÔNG đi được tới broker (chưa kết nối lần nào, hoặc
 * đang mất kết nối). Trước đây hàm này nuốt im lặng nên API vẫn báo "đã gửi lệnh"
 * dù không có gì rời khỏi backend — Technician đứng ở farm chờ thiết bị phản hồi.
 */
export function publishDeviceCommand(deviceId: string, type: DeviceCommandType, payload: object = {}): boolean {
  return publishTo(`${DEVICE_TOPIC_ROOT}/${deviceId}/cmd`, commandEnvelope(type, payload))
}

/** Report 4 §7.2 — cấu hình retained: tin cuối phải là bản đầy đủ, thiết bị nhận lại khi kết nối */
export function publishDeviceConfig(deviceId: string, config: object): boolean {
  return publishTo(`${DEVICE_TOPIC_ROOT}/${deviceId}/config`, config, true)
}

/**
 * Report 4 §7.2, BR-38 — offset bù thời tiết, retained: controller kết nối lại vẫn nhận bản cuối, và tự bỏ khi
 * `expires_at` đã qua
 */
export function publishDeviceCompensation(deviceId: string, compensation: object): boolean {
  return publishTo(`${DEVICE_TOPIC_ROOT}/${deviceId}/compensation`, compensation, true)
}

function publishTo(topic: string, payload: unknown, retain = false): boolean {
  if (!client?.connected) {
    logger.warn('Không gửi được lệnh MQTT — broker chưa kết nối', { topic })
    return false
  }
  client.publish(topic, JSON.stringify(payload), { qos: 1, retain })
  return true
}
