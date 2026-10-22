import type { AlertSeverity, AlertStatus } from '@/types'

export type InferredAlertType = 'NOISE_ANOMALY' | 'SENSOR_ANOMALY' | 'FORECAST_BREACH' | 'LOW_RETURN_RATE' | 'PUMP_DRY'
export type AlertVerdictResult = 'CONFIRMED' | 'REJECTED'

export interface ExpertVerdict {
  result: AlertVerdictResult
  note?: string
  by: { _id: string; full_name: string } | string
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
