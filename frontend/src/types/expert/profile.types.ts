// EXPERT-FR-014, 015 — Hồ sơ cấu hình (config profiles), SM-23
import type { ExpertThresholds, ExpertFuzzyTuning, ExpertDetectionTuning } from './tuning.types'

export type ConfigProfileStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED'
export type HouseStage = 'ATTRACTING' | 'OCCUPIED'

export interface SpeakerScheduleWindow {
  start: string  // "HH:00"
  end: string    // "HH:00"
}

export interface ProfileSpeakerSchedule {
  enabled: boolean
  windows: SpeakerScheduleWindow[]
}

// detection_tuning trong hồ sơ bỏ return_rate_drop_pct (đó là bird counting, backend tự trừ)
export type ProfileDetectionTuning = Omit<ExpertDetectionTuning, 'return_rate_drop_pct'>

export interface ConfigProfileInput {
  name: string
  stage?: HouseStage | null
  thresholds?: ExpertThresholds
  fuzzy_tuning?: ExpertFuzzyTuning
  detection_tuning?: ProfileDetectionTuning
  speaker_schedule?: ProfileSpeakerSchedule
}

export interface ProfileApplication {
  house_ids: string[]
  zone_count: number
  applied_by: string
  applied_at: string
}

export interface ConfigProfile extends ConfigProfileInput {
  _id: string
  farm_id: string
  author_id: string
  status: ConfigProfileStatus
  approved_by?: string | null
  approved_at?: string | null
  archived_at?: string | null
  applications: ProfileApplication[]
  created_at: string
  updated_at: string
}
