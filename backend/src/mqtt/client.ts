import mqtt, { MqttClient } from 'mqtt'
import fs from 'fs'
import logger from '@/utils/logger'
import { handleTelemetry }   from '@/mqtt/handlers/telemetryHandler'
import { handleHeartbeat }   from '@/mqtt/handlers/heartbeatHandler'
import { handleAlert }       from '@/mqtt/handlers/alertHandler'
import { handleBirdCount }   from '@/mqtt/handlers/birdCountHandler'
import { handleRelayStatus } from '@/mqtt/handlers/relayStatusHandler'

let client: MqttClient | null = null

const TOPICS = [
  'swiftletcare/+/+/+/telemetry',         // ENV-FR-001
  'swiftletcare/+/+/+/heartbeat',          // FARM-FR-005
  'swiftletcare/+/+/+/relay/status',       // ENV-FR-015
  'swiftletcare/+/+/+/vision/bird-count',  // VISION-FR-006
  'swiftletcare/+/+/+/vision/alert',       // THREAT-FR-001
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

  client.on('message', (topic: string, payload: Buffer) => {
    try {
      const message = JSON.parse(payload.toString()) as Record<string, unknown>
      const parts   = topic.split('/')  // [swiftletcare, farmId, houseId, zoneId, ...type]

      if (topic.endsWith('/telemetry'))        void handleTelemetry(parts, message)
      else if (topic.endsWith('/heartbeat'))   void handleHeartbeat(parts, message)
      else if (topic.endsWith('/relay/status'))void handleRelayStatus(parts, message)
      else if (topic.endsWith('/bird-count'))  void handleBirdCount(parts, message)
      else if (topic.endsWith('/vision/alert'))void handleAlert(parts, message)
    } catch (err) {
      logger.error('MQTT message parse error', { err })
    }
  })

  client.on('error',   (err: Error) => logger.error('MQTT error', { err }))
  client.on('offline', () => logger.warn('MQTT offline – reconnecting...'))
}

export function publishCommand(farmId: string, houseId: string, zoneId: string, subtopic: string, payload: unknown): void {
  const topic = `swiftletcare/${farmId}/${houseId}/${zoneId}/${subtopic}`
  client?.publish(topic, JSON.stringify(payload), { qos: 1 })
}
