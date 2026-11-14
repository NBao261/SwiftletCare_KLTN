// Module ALERT (§5.5) — cảnh báo và mức độ nghiêm trọng.
import type { SiteCause } from '@/types/workOrder.types'

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
// 3 cấp hiển thị của mức cảnh báo: P1 Khẩn cấp, P2 Cao, P3 Thường
export type SeverityLevel = 'P1' | 'P2' | 'P3'
// DISMISSED: Domain Expert bác bỏ cảnh báo suy luận (Report 3 §6.1, EXPERT-FR-003)
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH'     | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'      | 'MISTING_INEFFECTIVE'  // THREAT-FR-011 (SRS 3.1.0, trước là PUMP_DRY)
  | 'NOISE_ANOMALY'        | 'LOW_RETURN_RATE'      | 'EDGE_AI_DEGRADED'
  | 'UNEXPECTED_RESTART'                            // THREAT-FR-012 (SRS 3.1.0, trước là POWER_OUTAGE)
  | 'SENSOR_FAULT'         | 'RS485_BUS_FAILURE'
  | 'SENSOR_ANOMALY'       | 'FORECAST_BREACH'
  | 'MAINTENANCE_DUE'
  | 'ACTUATOR_FAULT'                                // THREAT-FR-014, BR-32
  | 'CONFIG_MISMATCH'                               // ENV-FR-027, BR-24 - backend tự tính

// Report 4 §6.1 — chi tiết sự cố. THRESHOLD_BREACH (ALERT-FR-012, G-05): chỉ số đã đủ thời gian chờ sớm nhất;
// UNEXPECTED_RESTART (THREAT-FR-012): reset_reason. Cảnh báo cũ không có (null)
export interface AlertDetails {
  metric?: 'temperature' | 'humidity' | 'light_lux' | 'nh3_ppm' | 'co2_ppm'
  observed?: number
  threshold?: number
  direction?: 'above' | 'below'
  started_at?: string
  reset_reason?: string
}

export interface Alert {
  _id: string; farm_id: string; zone_id?: string; node_id?: string
  /** SRS v2.1.8 — cảnh báo của cả nhà yến (camera đếm chim: EDGE_AI_DEGRADED, LOW_RETURN_RATE), không gắn Zone */
  house_id?: string
  type: AlertType; severity: AlertSeverity; title: string; message: string
  snapshot_url?: string; metadata?: Record<string, unknown>
  details?: AlertDetails | null
  status: AlertStatus; created_at: string
  previous_status?: 'ACTIVE' | 'ACKNOWLEDGED'
  acknowledged_at?: string; acknowledged_by?: string; acknowledgement_note?: string
  // ALERT-FR-018 — nguyên nhân tìm thấy tại chỗ, ghi khi xác nhận hoặc khi Work Order làm xong
  site_cause?: { cause: SiteCause; photo_urls?: string[]; by: string; at: string } | null
  expert_verdict?: {
    result: 'CONFIRMED' | 'REJECTED'
    note?: string | null
    by?: { _id: string; full_name: string } | string
    role?: 'DOMAIN_EXPERT' | 'FARM_OWNER'
    at: string
  }
}
