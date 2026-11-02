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
  my_rating_state: HealthRatingState;
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
