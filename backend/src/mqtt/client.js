'use strict';
/**
 * MQTT Client – Backend subscribes to ESP32 and RPi topics
 * SRS: §9.2, SEC-NFR-001
 */
const mqtt   = require('mqtt');
const fs     = require('fs');
const logger = require('../utils/logger');
const { handleTelemetry }  = require('./handlers/telemetryHandler');
const { handleHeartbeat }  = require('./handlers/heartbeatHandler');
const { handleAlert }      = require('./handlers/alertHandler');
const { handleBirdCount }  = require('./handlers/birdCountHandler');
const { handleRelayStatus } = require('./handlers/relayStatusHandler');

let client;

const TOPICS = [
  'swiftletcare/+/+/+/telemetry',      // ENV-FR-001
  'swiftletcare/+/+/+/heartbeat',      // FARM-FR-005
  'swiftletcare/+/+/+/relay/status',   // ENV-FR-015
  'swiftletcare/+/+/+/vision/bird-count', // VISION-FR-006
  'swiftletcare/+/+/+/vision/alert',   // THREAT-FR-001
];

function connectMQTT() {
  const options = {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    ca: fs.existsSync(process.env.MQTT_CA_CERT_PATH)
      ? fs.readFileSync(process.env.MQTT_CA_CERT_PATH) : undefined,
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  };

  client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

  client.on('connect', () => {
    logger.info('MQTT broker connected');
    TOPICS.forEach(topic => client.subscribe(topic, { qos: 1 }));
  });

  client.on('message', (topic, payload) => {
    try {
      const message = JSON.parse(payload.toString());
      const parts = topic.split('/');  // [swiftletcare, farmId, houseId, zoneId, ...type]

      if (topic.endsWith('/telemetry'))        handleTelemetry(parts, message);
      else if (topic.endsWith('/heartbeat'))   handleHeartbeat(parts, message);
      else if (topic.endsWith('/relay/status'))handleRelayStatus(parts, message);
      else if (topic.endsWith('/bird-count'))  handleBirdCount(parts, message);
      else if (topic.endsWith('/vision/alert'))handleAlert(parts, message);
    } catch (err) {
      logger.error('MQTT message parse error:', err);
    }
  });

  client.on('error',  err => logger.error('MQTT error:', err));
  client.on('offline', () => logger.warn('MQTT offline'));
}

function publishCommand(farmId, houseId, zoneId, subtopic, payload) {
  const topic = `swiftletcare/${farmId}/${houseId}/${zoneId}/${subtopic}`;
  client?.publish(topic, JSON.stringify(payload), { qos: 1 });
}

module.exports = { connectMQTT, publishCommand };
