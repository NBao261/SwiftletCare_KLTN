'use strict';
/** Alert Model – SRS §8.2, ALERT-FR-001 */
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  farm_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  zone_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  node_id:  { type: mongoose.Schema.Types.ObjectId },
  type: {
    type: String,
    enum: ['THRESHOLD_BREACH','PREDATOR_DETECTED','NODE_OFFLINE','SPEAKER_FAILURE',
           'PUMP_DRY','BIRD_PANIC','POWER_OUTAGE','LOW_RETURN_RATE','EDGE_AI_DEGRADED'],
    required: true,
  },
  severity:    { type: String, enum: ['CRITICAL','HIGH','MEDIUM','LOW'], required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  snapshot_url:       { type: String },   // Presigned URL (SEC-NFR-006)
  metadata:           { type: mongoose.Schema.Types.Mixed },
  status:             { type: String, enum: ['ACTIVE','ACKNOWLEDGED','RESOLVED'], default: 'ACTIVE' },
  created_at:         { type: Date, default: Date.now, index: true },
  acknowledged_at:    { type: Date },
  acknowledged_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgement_note: { type: String },
}, { versionKey: false });

// Deduplication query index (ALERT-FR-008)
alertSchema.index({ farm_id: 1, type: 1, zone_id: 1, created_at: -1 });

module.exports = mongoose.model('Alert', alertSchema);
