import type { HealthReason, HealthReasonCode, HealthSource } from '@/types'

/**
 * ANALYTICS-FR-012, EXPERT-FR-013 — câu của 1 lý do trạng thái ngày theo ngôn ngữ. Lý do lưu dạng mã
 * (HealthReason); web và mobile tự dịch bằng i18n của mình, backend chỉ cần câu cho CSV.
 */
export type ReasonLang = 'vi' | 'en'
export const REASON_LANGS: ReasonLang[] = ['vi', 'en']

type Values = Record<string, unknown>
type Phrase = (v: Values, level: string, source: HealthSource | null) => string

const LEVEL: Record<ReasonLang, Record<'SLIGHT' | 'CLEAR', string>> = {
  vi: { SLIGHT: 'nhẹ', CLEAR: 'rõ' },
  en: { SLIGHT: 'slight', CLEAR: 'clear' },
}

const zoneList = (v: Values) =>
  ((v.zones as { zone_name: string; valid_pct: number }[] | undefined) ?? []).map(z => `${z.zone_name} ${z.valid_pct} %`).join(', ')

const VI: Record<HealthReasonCode, Phrase> = {
  ALL_NORMAL: () => 'Các chỉ số đã đánh giá đều bình thường',
  MISSING_DATA: (v, _l, source) => {
    if (source === 'flock') {
      const missing = { MORNING: 'thiếu phiên sáng', EVENING: 'thiếu phiên chiều', NO_DEPARTURES: 'phiên sáng không có chim ra' }
      return `Thiếu dữ liệu đàn chim: ${missing[v.missing as keyof typeof missing] ?? ''}`
    }
    return v.no_zones
      ? 'Thiếu dữ liệu môi trường: nhà chưa có Zone'
      : `Thiếu dữ liệu môi trường: mẫu nhiệt độ, độ ẩm hợp lệ dưới ${v.min_pct} % (${zoneList(v)})`
  },
  NOT_ASSESSED: (_v, _l, source) =>
    source === 'air' ? 'Chưa đánh giá không khí (thiếu mẫu NH3, CO2)' : 'Chưa đánh giá tiếng ồn (thiếu mẫu độ ồn)',
  ENV_IN_RANGE: (v, l) => `Môi trường: ${v.zone_name} chỉ ${v.in_range_pct} % thời gian nhiệt độ, độ ẩm trong ngưỡng (mức ${l})`,
  AIR_OVER_LIMIT: (v, l) => `Không khí: NH3 hoặc CO2 vượt ngưỡng ${v.hours} giờ ở ${v.zone_name} (mức ${l})`,
  FLOCK_DROP: (v, l) =>
    `Đàn chim: tỷ lệ chim về ${v.return_rate} %, giảm ${v.drop_pct} % so với trung bình ${v.baseline_days} ngày trước (${v.baseline_avg} %) (mức ${l})`,
  FLOCK_NO_BASELINE: v => `Đàn chim: chưa đủ ${v.min_days} ngày nền để so sánh tỷ lệ chim về`,
  NOISE_EPISODES: (v, l) => `Tiếng ồn: ${v.episodes} đợt ồn bất thường (mức ${l})`,
  WEATHER_UNAVAILABLE: () => 'Không có dữ liệu thời tiết',
  RAIN_DOWNGRADE: v => `Mưa ≥ ${v.mm_per_hour} mm/giờ trùng phiên đếm và đợt ồn — hạ từ ACTION xuống WATCH (BR-30)`,
}

const EN: Record<HealthReasonCode, Phrase> = {
  ALL_NORMAL: () => 'All assessed indicators are normal',
  MISSING_DATA: (v, _l, source) => {
    if (source === 'flock') {
      const missing = { MORNING: 'no morning session', EVENING: 'no evening session', NO_DEPARTURES: 'no birds left in the morning session' }
      return `Missing flock data: ${missing[v.missing as keyof typeof missing] ?? ''}`
    }
    return v.no_zones
      ? 'Missing environment data: the house has no zone'
      : `Missing environment data: valid temperature and humidity samples below ${v.min_pct} % (${zoneList(v)})`
  },
  NOT_ASSESSED: (_v, _l, source) =>
    source === 'air' ? 'Air quality not assessed (missing NH3, CO2 samples)' : 'Noise not assessed (missing sound level samples)',
  ENV_IN_RANGE: (v, l) => `Environment: ${v.zone_name} kept temperature and humidity in range only ${v.in_range_pct} % of the time (${l} level)`,
  AIR_OVER_LIMIT: (v, l) => `Air quality: NH3 or CO2 above the limit for ${v.hours} h in ${v.zone_name} (${l} level)`,
  FLOCK_DROP: (v, l) =>
    `Flock: return rate ${v.return_rate} %, ${v.drop_pct} % below the mean of the ${v.baseline_days} previous days (${v.baseline_avg} %) (${l} level)`,
  FLOCK_NO_BASELINE: v => `Flock: fewer than ${v.min_days} baseline days to compare the return rate`,
  NOISE_EPISODES: (v, l) => `Noise: ${v.episodes} abnormal noise episodes (${l} level)`,
  WEATHER_UNAVAILABLE: () => 'No weather data',
  RAIN_DOWNGRADE: v => `Rain ≥ ${v.mm_per_hour} mm/h during a counting session and a noise episode — ACTION lowered to WATCH (BR-30)`,
}

const PHRASES: Record<ReasonLang, Record<HealthReasonCode, Phrase>> = { vi: VI, en: EN }

export function formatReason(reason: HealthReason, lang: ReasonLang = 'vi'): string {
  const level = reason.level ? LEVEL[lang][reason.level] : ''
  return PHRASES[lang][reason.code](reason.values ?? {}, level, reason.source)
}
