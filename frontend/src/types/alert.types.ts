// Module ALERT (§5.5) — cảnh báo và mức độ nghiêm trọng.

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'PREDATOR_DETECTED' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'PUMP_DRY'          | 'NOISE_ANOMALY'
  | 'POWER_OUTAGE'     | 'LOW_RETURN_RATE'   | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'     | 'RS485_BUS_FAILURE'
  | 'SENSOR_ANOMALY'   | 'FORECAST_BREACH'
  | 'MAINTENANCE_DUE'

export interface Alert {
  _id: string; farm_id: string; zone_id?: string; node_id?: string
  /** SRS v2.1.8 — cảnh báo của cả nhà yến (camera đếm chim: EDGE_AI_DEGRADED, LOW_RETURN_RATE), không gắn Zone */
  house_id?: string
  type: AlertType; severity: AlertSeverity; title: string; message: string
  snapshot_url?: string; metadata?: Record<string, unknown>
  status: AlertStatus; created_at: string
  acknowledged_at?: string; acknowledged_by?: string; acknowledgement_note?: string
}
