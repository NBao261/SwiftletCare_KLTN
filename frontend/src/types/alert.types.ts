// Module ALERT: cảnh báo và mức độ nghiêm trọng.
import type { SiteCause } from '@/types/workOrder.types'
import type { OnsiteCheck } from '@/types/expert/alerts.types'

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
// 4 cấp hiển thị của mức cảnh báo, mỗi cấp một mức backend: P1 Khẩn cấp, P2 Cao, P3 Trung bình, P4 Thấp
export type SeverityLevel = 'P1' | 'P2' | 'P3' | 'P4'
// DISMISSED: Domain Expert bác bỏ cảnh báo suy luận
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH'     | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'      | 'MISTING_INEFFECTIVE'  // (trước là PUMP_DRY)
  | 'NOISE_ANOMALY'        | 'LOW_RETURN_RATE'      | 'EDGE_AI_DEGRADED'
  | 'UNEXPECTED_RESTART'                            // (trước là POWER_OUTAGE)
  | 'SENSOR_FAULT'         | 'RS485_BUS_FAILURE'
  | 'SENSOR_ANOMALY'       | 'FORECAST_BREACH'
  | 'MAINTENANCE_DUE'
  | 'ACTUATOR_FAULT'
  | 'CONFIG_MISMATCH'                               // backend tự tính

// THRESHOLD_BREACH: chỉ số đủ thời gian chờ sớm nhất; UNEXPECTED_RESTART: reset_reason; cảnh báo cũ là null
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
  // cảnh báo của cả nhà yến (camera đếm chim: EDGE_AI_DEGRADED, LOW_RETURN_RATE), không gắn Zone
  house_id?: string
  type: AlertType; severity: AlertSeverity; title: string; message: string
  snapshot_url?: string; metadata?: Record<string, unknown>
  details?: AlertDetails | null
  status: AlertStatus; created_at: string
  previous_status?: 'ACTIVE' | 'ACKNOWLEDGED'
  acknowledged_at?: string; acknowledged_by?: string; acknowledgement_note?: string
  // nguyên nhân tìm thấy tại chỗ, ghi khi xác nhận hoặc khi Work Order làm xong
  site_cause?: { cause: SiteCause; photo_urls?: string[]; by: string; at: string } | null
  // yêu cầu kiểm tra tại chỗ của cảnh báo suy luận gửi thợ của nhà (tối đa 1)
  onsite_checks?: OnsiteCheck[] | null
  expert_verdict?: {
    result: 'CONFIRMED' | 'REJECTED'
    note?: string | null
    by?: { _id: string; full_name: string } | string
    role?: 'DOMAIN_EXPERT' | 'FARM_OWNER'
    at: string
  }
}
