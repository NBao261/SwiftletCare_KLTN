// Module ALERT (§5.5) — cảnh báo và mức độ nghiêm trọng.

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'PREDATOR_DETECTED' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'PUMP_DRY'          | 'BIRD_PANIC'
  | 'POWER_OUTAGE'     | 'LOW_RETURN_RATE'   | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'     | 'RS485_BUS_FAILURE'

export interface Alert {
  _id: string; farm_id: string; zone_id?: string; node_id?: string
  type: AlertType; severity: AlertSeverity; title: string; message: string
  snapshot_url?: string; metadata?: Record<string, unknown>
  status: AlertStatus; created_at: string
  acknowledged_at?: string; acknowledged_by?: string; acknowledgement_note?: string
}
