export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
// DISMISSED: cảnh báo suy luận bị bác bỏ (EXPERT-FR-003), không còn hiệu lực; đổi kết luận sang CONFIRMED thì về previous_status
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

// Người kết luận: backend populate { _id, full_name } (api-spec Alert.expert_verdict); kết luận trước G-03 không có role
export interface AlertVerdict {
  result: AlertVerdictResult
  note?: string | null
  by: { _id: string; full_name?: string } | null
  role?: 'DOMAIN_EXPERT' | 'FARM_OWNER'
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

// Bằng chứng của cảnh báo suy luận (ALERT-FR-014, GET /alerts/{id}/evidence, api-spec AlertEvidence). Mỗi nguồn có
// status ok | missing — missing là không có dữ liệu trong cửa sổ, không phải 0
export type EvidenceSourceStatus = 'ok' | 'missing'

export interface EvidenceTelemetrySample {
  timestamp: string
  temperature?: number | null
  humidity?: number | null
  nh3_ppm?: number | null
  co2_ppm?: number | null
  sound_db?: number | null
}

export interface AlertEvidence {
  alert_id: string
  type: AlertType
  window: { from: string; to: string }
  // Loại theo zone: mẫu số đo của zone, số đếm 5 phút của nhà chứa zone
  telemetry?: { status: EvidenceSourceStatus; samples: EvidenceTelemetrySample[] } | null
  bird_counts?: {
    status: EvidenceSourceStatus
    buckets: { bucket_start: string; entry_count: number; exit_count: number }[]
  } | null
  // LOW_RETURN_RATE: % thời gian trong ngưỡng của từng zone trong ngày, tiếng ồn lạ của nhà trong ngày
  zones_in_range?:
    | {
        zone_id: string
        name: string
        status: EvidenceSourceStatus
        temp_in_range_pct: number | null
        humidity_in_range_pct: number | null
      }[]
    | null
  noise_alerts?: Alert[] | null
  device_alerts: Alert[]
  // Tối đa 10 cảnh báo trước cùng loại, cùng zone/nhà, đã có kết luận (EXPERT-FR-003)
  earlier_verdicts: Alert[]
}
