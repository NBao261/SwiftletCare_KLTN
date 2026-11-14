import type { AlertSeverity, AlertStatus } from '@/types'

export type InferredAlertType = 'NOISE_ANOMALY' | 'SENSOR_ANOMALY' | 'FORECAST_BREACH' | 'LOW_RETURN_RATE' | 'MISTING_INEFFECTIVE' // PUMP_DRY → MISTING_INEFFECTIVE (SRS 3.1.0)
export type AlertVerdictResult = 'CONFIRMED' | 'REJECTED'

export interface ExpertVerdict {
  result: AlertVerdictResult
  note?: string | null
  by?: { _id: string; full_name: string } | string
  role?: 'DOMAIN_EXPERT' | 'FARM_OWNER'
  at: string
}

export interface InferredAlertItem {
  _id: string
  farm_id: string
  zone_id?: string
  node_id?: string
  type: InferredAlertType
  severity: AlertSeverity
  status: AlertStatus
  previous_status?: 'ACTIVE' | 'ACKNOWLEDGED'
  title: string
  message: string
  snapshot_url?: string
  metadata?: Record<string, unknown>
  occurrence_count?: number
  created_at: string
  last_seen_at?: string
  acknowledged_at?: string
  acknowledgement_note?: string
  expert_verdict?: ExpertVerdict
}

export interface ExpertVerdictStats {
  type: InferredAlertType
  confirmed: number
  rejected: number
  pending: number
  confirmedPct: number | null
}

/** ALERT-FR-014 — Bằng chứng của cảnh báo suy luận */
export interface TelemetrySample {
  timestamp: string
  temperature?: number | null
  humidity?: number | null
  nh3_ppm?: number | null
  co2_ppm?: number | null
  sound_db?: number | null
}

export interface BirdCountBucket {
  bucket_start: string
  entry_count: number
  exit_count: number
}

export interface ZoneInRange {
  zone_id: string
  name: string
  status: 'ok' | 'missing'
  temp_in_range_pct: number | null
  humidity_in_range_pct: number | null
}

/** EXPERT-FR-021 — quan sát tại chỗ của Kỹ thuật viên */
export type OnsiteObservation =
  | 'BIRDS_DISTURBED'
  | 'WORK_OR_PEOPLE_NEARBY'
  | 'RAIN'
  | 'SENSOR_DIRTY_OR_FAULTY'
  | 'NOTHING_UNUSUAL'
  | 'OTHER'

export interface OnsiteCheck {
  technician_id?: { _id: string; full_name: string }
  requested_at: string
  observation: OnsiteObservation | null
  note?: string | null
  photo_url?: string | null
  answered_by?: { _id: string; full_name: string } | null
  answered_at?: string | null
}

export interface AlertEvidence {
  alert_id: string
  type: InferredAlertType
  window: { from: string; to: string }
  telemetry?: {
    status: 'ok' | 'missing'
    samples: TelemetrySample[]
  } | null
  bird_counts?: {
    status: 'ok' | 'missing'
    buckets: BirdCountBucket[]
  } | null
  zones_in_range?: ZoneInRange[] | null
  noise_alerts?: InferredAlertItem[] | null
  device_alerts: InferredAlertItem[]
  earlier_verdicts: InferredAlertItem[]
  onsite_checks?: OnsiteCheck[] | null
}

/** EXPERT-FR-009 — Lịch sử hoạt động chuyên gia trên farm */
export interface ExpertActivityEntry {
  _id: string
  action: string
  actor: { _id: string; full_name: string } | null
  actor_role: 'DOMAIN_EXPERT' | 'FARM_OWNER'
  target_type: string
  target_id?: string
  zone_id?: string | null
  house_id?: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ExpertActivityQuery {
  farmId: string
  houseId?: string
  zoneId?: string
  type?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}
