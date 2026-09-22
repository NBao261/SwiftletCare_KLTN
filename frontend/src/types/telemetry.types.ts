// Module TELEMETRY (§5.4) — bản ghi đo môi trường gửi lên từ Sensor Node.

export interface TelemetryRecord {
  _id?: string; node_id?: string; zone_id?: string
  timestamp: string; temperature?: number; humidity?: number
  light_lux?: number; nh3_ppm?: number; co2_ppm?: number; sound_db?: number; is_anomaly: boolean
}
