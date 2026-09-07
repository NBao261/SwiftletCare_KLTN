'use strict';
/** Telemetry Model – SRS §8.2, time-series heavy write */
const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema({
  node_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'SensorNode', required: true },
  zone_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
  timestamp:   { type: Date, required: true, index: true },  // TTL: 1 year
  temperature: { type: Number },
  humidity:    { type: Number },
  light_lux:   { type: Number },
  co2_ppm:     { type: Number },
  sound_db:    { type: Number },
  is_anomaly:  { type: Boolean, default: false },
}, { timestamps: false, versionKey: false });

// Compound index for time-range queries (ANALYTICS-FR-001)
telemetrySchema.index({ node_id: 1, timestamp: -1 });
telemetrySchema.index({ zone_id: 1, timestamp: -1 });
// TTL index: auto-delete after 1 year (§8.2)
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('Telemetry', telemetrySchema);
