// Hồ sơ cấu hình (config profiles)
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

// detection_tuning trong hồ sơ: 5 tham số của Zone (mức giảm tỷ lệ chim về thuộc nhà, không có trong hồ sơ)
export type ProfileDetectionTuning = ExpertDetectionTuning

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
