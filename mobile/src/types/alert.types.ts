export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
// DISMISSED: Domain Expert bác bỏ cảnh báo suy luận (EXPERT-FR-003) — backend chưa ghi giá trị này (Known debt)
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

// Phán quyết của chuyên gia cho cảnh báo suy luận (EXPERT-FR-003); by là id người phán quyết
export type AlertVerdictResult = 'CONFIRMED' | 'REJECTED'

export interface AlertVerdict {
  result: AlertVerdictResult
  note?: string
  by: string
  at: string
}

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
  // Cũng chứa lý do hệ thống ghi khi tự đóng cảnh báo
  acknowledgement_note?: string
  // Lần gặp gần nhất và số lần lặp lại (ALERT-FR-008)
  last_seen_at?: string
  occurrence_count?: number
  resolved_at?: string
  // Đã gửi nhắc lại một lần khi chưa ai xác nhận (ALERT-FR-015)
  renotified_at?: string
  // Không có là chưa phán quyết
  expert_verdict?: AlertVerdict
}
