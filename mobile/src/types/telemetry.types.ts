// Một bản ghi cảm biến của Zone
export interface TelemetryRecord {
  _id: string
  node_id: string
  zone_id: string
  timestamp: string
  temperature?: number
  humidity?: number
  light_lux?: number
  nh3_ppm?: number
  co2_ppm?: number
  sound_db?: number
  // % phun sương và % quạt do bộ điều khiển mờ tính (firmware ≥ 1.1.0)
  misting_pct?: number | null
  ventilation_pct?: number | null
  is_anomaly: boolean
}
