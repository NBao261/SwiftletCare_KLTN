import { Schema, model, Document, Types } from 'mongoose'
import type { AlertType, AlertSeverity, AlertStatus } from '@/types'

/** Alert document – SRS §8.2, ALERT-FR-001 */
export interface IAlert extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  zone_id?: Types.ObjectId
  node_id?: Types.ObjectId
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  snapshot_url?: string
  metadata?: Record<string, unknown>
  status: AlertStatus
  created_at: Date
  acknowledged_at?: Date
  acknowledged_by?: Types.ObjectId
  acknowledgement_note?: string
}

const alertSchema = new Schema<IAlert>(
  {
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    zone_id:  { type: Schema.Types.ObjectId, ref: 'Zone' },
    node_id:  { type: Schema.Types.ObjectId },
    type: {
      type: String,
      enum: [
        'THRESHOLD_BREACH','PREDATOR_DETECTED','NODE_OFFLINE','SPEAKER_FAILURE',
        'PUMP_DRY','BIRD_PANIC','POWER_OUTAGE','LOW_RETURN_RATE','EDGE_AI_DEGRADED',
      ] as AlertType[],
      required: true,
    },
    severity:    { type: String, enum: ['CRITICAL','HIGH','MEDIUM','LOW'] as AlertSeverity[], required: true },
    title:       { type: String, required: true },
    message:     { type: String, required: true },
    snapshot_url:        { type: String },
    metadata:            { type: Schema.Types.Mixed },
    status:              { type: String, enum: ['ACTIVE','ACKNOWLEDGED','RESOLVED'] as AlertStatus[], default: 'ACTIVE' },
    created_at:          { type: Date, default: Date.now },
    acknowledged_at:     { type: Date },
    acknowledged_by:     { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgement_note:{ type: String },
  },
  { versionKey: false }
)

// Deduplication query index (ALERT-FR-008)
alertSchema.index({ farm_id: 1, type: 1, zone_id: 1, created_at: -1 })

export const Alert = model<IAlert>('Alert', alertSchema)
