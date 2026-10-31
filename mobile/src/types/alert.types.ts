export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
// DISMISSED: Domain Expert bác bỏ cảnh báo suy luận (EXPERT-FR-003)
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'RESOLVED'

// Khớp backend/src/types/domain.types.ts (SRS 3.1.0)
export type AlertType =
  | 'THRESHOLD_BREACH'
  | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'
  | 'MISTING_INEFFECTIVE' // trước là PUMP_DRY
  | 'NOISE_ANOMALY'
  | 'UNEXPECTED_RESTART' // trước là POWER_OUTAGE
  | 'LOW_RETURN_RATE'
  | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'
  | 'RS485_BUS_FAILURE'
  | 'SENSOR_ANOMALY'
  | 'FORECAST_BREACH'
  | 'MAINTENANCE_DUE'
  | 'ACTUATOR_FAULT'
  | 'CONFIG_MISMATCH'

export interface Alert {
  _id: string
  farm_id: string
  zone_id?: string
  // Cảnh báo của cả nhà yến (camera đếm chim) — khi đó không có zone_id
  house_id?: string
  node_id?: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  snapshot_url?: string
  metadata?: Record<string, unknown>
  status: AlertStatus
  created_at: string
  acknowledged_at?: string
  acknowledged_by?: string
  acknowledgement_note?: string
}
