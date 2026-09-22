// Module VISION (§5.6) — đếm chim ra/vào. Pipeline AI chưa triển khai, đây là shape đã chốt.

export type SessionType = 'MORNING_EXIT' | 'EVENING_ENTRY'

export interface BirdCountRecord {
  _id: string; zone_id: string; timestamp: string
  session_type: SessionType; entry_count: number; exit_count: number
  return_rate: number; confidence_avg: number
}
