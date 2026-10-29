// Phiên đếm chim: sáng chim ra, chiều chim về
export type SessionType = 'MORNING_EXIT' | 'EVENING_ENTRY'

export interface BirdCountRecord {
  _id: string
  camera_node_id: string
  zone_id: string
  timestamp: string
  session_type: SessionType
  entry_count: number
  exit_count: number
  return_rate: number
  confidence_avg?: number
}
