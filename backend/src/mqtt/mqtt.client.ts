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

const HANDLERS: Record<DeviceUplink, (topicParts: string[], message: Record<string, unknown>) => Promise<void>> = {
  telemetry: handleTelemetry,
  'telemetry/buffered': handleTelemetry,
  heartbeat: handleHeartbeat,
  'relay/status': handleRelayStatus,
  alert: handleAlert,
  'vision/alert': handleAlert,
  'vision/bird-count': handleBirdCount,
}

export function connectMQTT(): void {
  // EMQX hỏi /internal/mqtt-auth cả với backend: thiếu khoá là 401 lặp mãi
  if (!process.env.MQTT_AUTH_KEY) {
    logger.error('Thiếu MQTT_AUTH_KEY: EMQX sẽ từ chối mọi kết nối, kể cả backend (MQTT code 5). '
      + 'Đặt cùng giá trị với khoá EMQX gửi kèm /internal/mqtt-auth (docker-compose.yml, mặc định CHANGE_ME)')
  }
  const caPath = process.env.MQTT_CA_CERT_PATH ?? ''
  const options: mqtt.IClientOptions = {
    // Phiên bền giữ tin QoS 1 khi backend restart; `||` vì ID rỗng bị broker từ chối
    clientId: process.env.MQTT_CLIENT_ID || 'swiftletcare-backend',
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
    subscribeUplinks(client!)
  })

  client.on('message', (topic: string, payload: Buffer, packet: mqtt.IPublishPacket) => {
    routeDeviceMessage(topic, payload, packet.retain)
  })

  client.on('error',   (err: Error) => logger.error('MQTT error', { err }))
  client.on('offline', () => logger.warn('MQTT offline – reconnecting...'))
}

// Bỏ tin retained (tin cũ phát lại khi reconnect) và tin có deviceId khác topic
// Broker vừa khởi động có thể từ chối (SUBACK 128) trước khi nạp xong ACL; không thử lại thì backend không nhận tin nào
function subscribeUplinks(mqttClient: MqttClient): void {
  const topics = DEVICE_UPLINKS.map(uplink => `${DEVICE_TOPIC_ROOT}/+/${uplink}`)
  mqttClient.subscribe(topics, { qos: 1 }, (err, granted) => {
    const refused = (granted ?? []).filter(grant => grant.qos === 128).map(grant => grant.topic)
    if (!err && refused.length === 0) return
    logger.error('MQTT subscribe bị từ chối, thử lại', { err, refused })
    setTimeout(() => { if (mqttClient.connected) subscribeUplinks(mqttClient) }, mqttClient.options.reconnectPeriod ?? 1000)
  })
}

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

// false khi chưa kết nối broker: API không được báo đã gửi lệnh
export function publishDeviceCommand(deviceId: string, type: DeviceCommandType, payload: object = {}): boolean {
  return publishTo(`${DEVICE_TOPIC_ROOT}/${deviceId}/cmd`, commandEnvelope(type, payload))
}

// Retained: tin cuối phải là bản đầy đủ
export function publishDeviceConfig(deviceId: string, config: object): boolean {
  return publishTo(`${DEVICE_TOPIC_ROOT}/${deviceId}/config`, config, true)
}

// retained: thiết bị tự bỏ khi qua expires_at
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
