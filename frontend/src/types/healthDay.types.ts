// Module ANALYTICS / EXPERT — trạng thái sức khỏe ngày của nhà yến, chấm điểm độc lập (MF-11; api-spec HouseHealthDay)

export type HealthStatus = 'GOOD' | 'WATCH' | 'ACTION' | 'INSUFFICIENT_DATA';
export type HealthRatingValue = 'GOOD' | 'WATCH' | 'ACTION';
export type HealthLevel = 'NORMAL' | 'SLIGHT' | 'CLEAR';
export type HealthSource = 'environment' | 'air' | 'flock' | 'noise';
// SM-18 — trạng thái chấm của chính người gọi
export type HealthRatingState = 'PENDING' | 'RATED' | 'SKIPPED' | 'EXPIRED';

export type HealthReasonCode =
  | 'ALL_NORMAL' | 'MISSING_DATA' | 'NOT_ASSESSED' | 'ENV_IN_RANGE' | 'AIR_OVER_LIMIT'
  | 'FLOCK_DROP' | 'FLOCK_NO_BASELINE' | 'NOISE_EPISODES' | 'WEATHER_UNAVAILABLE' | 'RAIN_DOWNGRADE';

// Lý do dạng mã + số liệu, client tự dịch (api-spec HealthReason)
export interface HealthReason {
  code: HealthReasonCode;
  source: HealthSource | null;
  level: 'SLIGHT' | 'CLEAR' | null;
  values: Record<string, unknown>;
}

export interface HealthIndicator {
  value: number | null;
  // null khi nguồn không đủ dữ liệu (không đánh giá)
  level: HealthLevel | null;
  details?: Record<string, unknown>;
}

export interface HealthDayWeather {
  temperature_min: number | null;
  temperature_max: number | null;
  humidity_avg: number | null;
  precipitation_mm: number | null;
  hours: number;
}

export interface HealthDayRating {
  _id: string;
  by: { _id: string; full_name: string | null };
  role: 'FARM_OWNER' | 'DOMAIN_EXPERT';
  outcome: 'RATED' | 'SKIPPED';
  rating: HealthRatingValue | null;
  note: string | null;
  at: string;
  snapshot: { status: HealthStatus; reasons: HealthReason[] };
}

// Ngày người gọi còn PENDING chỉ có phần chung (BR-31): không trạng thái, lý do, chỉ số hay điểm của người khác
export interface HouseHealthDay {
  _id: string;
  house_id: string;
  house_name: string;
  farm_id: string;
  // 'YYYY-MM-DD' giờ VN
  date: string;
  weather: HealthDayWeather | null;
  computed_at: string;
  // null = người xem không phải người chấm (Domain Expert, SRS 4.2.0): thấy đủ trạng thái, không có hạn chấm
  my_rating_state: HealthRatingState | null;
  rating_deadline: string;
  indicators?: Record<HealthSource, HealthIndicator>;
  completeness?: Record<HealthSource, boolean>;
  current_status?: HealthStatus;
  current_reasons?: HealthReason[];
  evidence?: { noise_alert_ids: string[] };
  ratings?: HealthDayRating[];
}

// BR-28 — mức chỉ số sức khỏe của nhà yến
export interface HealthLevels {
  in_range_slight_pct: number;
  in_range_clear_pct: number;
  air_slight_h: number;
  air_clear_h: number;
  noise_slight: number;
  noise_clear: number;
}

export interface HouseHealthLevels {
  house_id: string;
  health_levels: HealthLevels;
  defaults: HealthLevels;
}

// EXPERT-FR-005 — báo cáo sức khỏe theo nhà yến (api-spec HouseHealthReportSummary, BR-33; CUSTOM do người dùng tạo)
export type HealthReportKind = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface HouseHealthReportSummary {
  _id: string;
  farm_id: string;
  house_id: string;
  house_name: string;
  kind: HealthReportKind;
  // 'YYYY-MM-DD' giờ VN, tính cả 2 đầu
  period_start: string;
  period_end: string;
  generated_at: string;
  has_conclusion: boolean;
  // Đề xuất cho backend (chưa có trong api-spec): kèm kết luận ở danh sách để bảng hiện được; thiếu thì bảng chỉ ghi "Đã có kết luận"
  expert_conclusion?: {
    text: string;
    by: { _id: string; full_name: string | null };
    at: string;
    edited_at?: string | null;
  } | null;
}

export interface HealthReportZoneSection {
  zone_id: string;
  zone_name: string;
  sample_count: number;
  temp_in_range_pct: number | null;
  humidity_in_range_pct: number | null;
  auto_mode_pct: number | null;
  misting_switches: number;
  ventilation_switches: number;
  alerts_by_type: Record<string, number>;
  inferred_alerts: { confirmed: number; dismissed: number; pending: number };
  device_faults: Record<string, number>;
  nh3_avg: number | null;
  nh3_max: number | null;
  co2_avg: number | null;
  co2_max: number | null;
}

// Chi tiết báo cáo: days che theo người gọi (BR-31), status_counts chỉ đếm ngày đã thấy
export interface HouseHealthReport extends HouseHealthReportSummary {
  house_metrics: {
    return_rate_trend: Array<{ date: string; return_rate: number | null; complete: boolean }>;
    avg_return_rate: number | null;
    weather: {
      temperature_min: number | null;
      temperature_max: number | null;
      humidity_avg: number | null;
      precipitation_mm: number | null;
      rain_days: number;
    } | null;
  };
  zone_sections: HealthReportZoneSection[];
  days: HouseHealthDay[];
  status_counts: Record<HealthStatus, number>;
  hidden_days: number;
}
