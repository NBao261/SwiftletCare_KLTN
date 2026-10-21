import mqtt, { MqttClient } from 'mqtt'
import fs from 'fs'
import logger from '@/utils/logger.util'
import { handleTelemetry }   from '@/mqtt/handlers/telemetry.handler'
import { handleHeartbeat }   from '@/mqtt/handlers/heartbeat.handler'
import { handleAlert }       from '@/mqtt/handlers/alert.handler'
import { handleBirdCount }   from '@/mqtt/handlers/birdCount.handler'
import { handleRelayStatus } from '@/mqtt/handlers/relayStatus.handler'

let client: MqttClient | null = null

// ESP32 theo Zone: swiftletcare/{farm}/{house}/{zone}/…
// Nút AI đếm chim theo House (SRS v2.1.8, camera ở cửa ra vào của cả nhà): swiftletcare/{farm}/{house}/…
const TOPICS = [
  'swiftletcare/+/+/+/telemetry',         // ENV-FR-001
  'swiftletcare/+/+/+/heartbeat',          // FARM-FR-005 (ESP32)
  'swiftletcare/+/+/+/relay/status',       // ENV-FR-015
  // THREAT-FR-006/011/012/013 (ESP32 {zone}/alert) — cũng khớp `{house}/vision/alert` của nút AI
  // (EDGE_AI_DEGRADED, THREAT-FR-010): không đăng ký thêm mẫu riêng kẻo broker giao trùng tin
  'swiftletcare/+/+/+/alert',
  'swiftletcare/+/+/heartbeat',            // THREAT-FR-010 (nút AI)
  'swiftletcare/+/+/vision/bird-count',    // VISION-FR-006
] as const

export function connectMQTT(): void {
  const caPath = process.env.MQTT_CA_CERT_PATH ?? ''
  const options: mqtt.IClientOptions = {
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
    TOPICS.forEach(topic => client!.subscribe(topic, { qos: 1 }))
  })

  client.on('message', (topic: string, payload: Buffer, packet: mqtt.IPublishPacket) => {
    // Mọi topic thiết bị là trạng thái sống — message retained (VD relay/status
    // do firmware cũ publish retain=true) được broker phát lại cho MỌI thiết bị
    // mỗi lần backend (re)connect, kể cả thiết bị đã chết → bỏ qua.
    if (packet.retain) return
    try {
      const message = JSON.parse(payload.toString()) as Record<string, unknown>
      const parts   = topic.split('/')  // [swiftletcare, farmId, houseId, zoneId, ...type] (nút AI: không có zoneId)

      if (topic.endsWith('/telemetry'))        void handleTelemetry(parts, message)
      else if (topic.endsWith('/heartbeat'))   void handleHeartbeat(parts, message)
      else if (topic.endsWith('/relay/status'))void handleRelayStatus(parts, message)
      else if (topic.endsWith('/bird-count'))  void handleBirdCount(parts, message)
      else if (topic.endsWith('/alert'))       void handleAlert(parts, message)  // cả {zone}/alert (ESP32) lẫn {house}/vision/alert (nút AI)
    } catch (err) {
      logger.error('MQTT message parse error', { err })
    }
  })

  client.on('error',   (err: Error) => logger.error('MQTT error', { err }))
  client.on('offline', () => logger.warn('MQTT offline – reconnecting...'))
}

/**
 * Trả về false khi lệnh KHÔNG đi được tới broker (chưa kết nối lần nào, hoặc
 * đang mất kết nối). Trước đây hàm này nuốt im lặng nên API vẫn báo "đã gửi lệnh"
 * dù không có gì rời khỏi backend — Technician đứng ở farm chờ thiết bị phản hồi.
 */
export function publishCommand(farmId: string, houseId: string, zoneId: string, subtopic: string, payload: unknown): boolean {
  return publishTo(`swiftletcare/${farmId}/${houseId}/${zoneId}/${subtopic}`, payload)
}

/** Nút AI đếm chim nghe lệnh theo House, không có đoạn zone (SRS v2.1.8) */
export function publishHouseCommand(farmId: string, houseId: string, subtopic: string, payload: unknown): boolean {
  return publishTo(`swiftletcare/${farmId}/${houseId}/${subtopic}`, payload)
}

function publishTo(topic: string, payload: unknown): boolean {
  if (!client?.connected) {
    logger.warn('Không gửi được lệnh MQTT — broker chưa kết nối', { topic })
    return false
  }
  client.publish(topic, JSON.stringify(payload), { qos: 1 })
  return true
}
