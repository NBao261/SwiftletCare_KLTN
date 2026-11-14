/**
 * Định nghĩa dải tham số chuẩn (Standard Tuning Ranges) và logic kiểm tra giới hạn.
 * Tuân thủ SRS v3.1.0 (EXPERT-FR-004, EXPERT-FR-008, BR-01, BR-02, BR-05, BR-09a-f, BR-28).
 */

export interface TuningParamConfig {
  min: number
  max: number
  step: number
  default: number
  unit: string
  label: string
}

export const TUNING_RANGES = {
  // ── Nhóm 1: Ngưỡng an toàn vi khí hậu (BR-01, BR-02, ENV-FR-006) ──
  temp_min: {
    min: 20.0,
    max: 35.0,
    step: 0.5,
    default: 26.0,
    unit: '°C',
    label: 'Nhiệt độ tối thiểu',
  },
  temp_max: {
    min: 20.0,
    max: 40.0,
    step: 0.5,
    default: 31.0,
    unit: '°C',
    label: 'Nhiệt độ tối đa',
  },
  humidity_min: {
    min: 50.0,
    max: 95.0,
    step: 1.0,
    default: 75.0,
    unit: '%',
    label: 'Độ ẩm tối thiểu',
  },
  humidity_max: {
    min: 60.0,
    max: 100.0,
    step: 1.0,
    default: 85.0,
    unit: '%',
    label: 'Độ ẩm tối đa',
  },
  co2_max: {
    min: 500,
    max: 5000,
    step: 50,
    default: 1000,
    unit: 'ppm',
    label: 'Khí CO₂ tối đa',
  },
  nh3_max: {
    min: 5,
    max: 100,
    step: 1,
    default: 15,
    unit: 'ppm',
    label: 'Khí NH₃ tối đa',
  },
  light_max: {
    min: 0.0,
    max: 50.0,
    step: 0.5,
    default: 2.0,
    unit: 'lux',
    label: 'Ánh sáng tối đa',
  },

  // ── Nhóm 2: Hệ số điều khiển mờ Sugeno Fuzzy (BR-05, ENV-FR-021) ──
  fuzzy_humidity_band: {
    min: 2.0,
    max: 20.0,
    step: 0.5,
    default: 8.0,
    unit: '%',
    label: 'Dải dung sai độ ẩm mờ',
  },
  fuzzy_temp_band: {
    min: 1.0,
    max: 10.0,
    step: 0.5,
    default: 4.0,
    unit: '°C',
    label: 'Dải dung sai nhiệt độ mờ',
  },
  fuzzy_fan_dry_level: {
    min: 0,
    max: 100,
    step: 5,
    default: 40,
    unit: '%',
    label: 'Công suất quạt khô sàn',
  },
  fuzzy_window_sec: {
    min: 60,
    max: 600,
    step: 15,
    default: 120,
    unit: 's',
    label: 'Cửa sổ trượt chu kỳ',
  },

  // ── Nhóm 3: Tham số phát hiện dị thường cấp Zone (EXPERT-FR-008, BR-09a-e) ──
  noise_margin_db: {
    min: 5,
    max: 30,
    step: 1,
    default: 15,
    unit: 'dB',
    label: 'Biên độ ồn vượt baseline',
  },
  noise_min_sec: {
    min: 5,
    max: 15,
    step: 1,
    default: 10,
    unit: 's',
    label: 'Thời gian duy trì tiếng ồn',
  },
  pump_dry_on_sec: {
    min: 120,
    max: 900,
    step: 30,
    default: 300,
    unit: 's',
    label: 'Thời gian bơm chạy liên tục',
  },
  pump_dry_min_rise_pct: {
    min: 0.5,
    max: 10.0,
    step: 0.5,
    default: 2.0,
    unit: '%',
    label: 'Độ ẩm tối thiểu phải tăng',
  },
  speaker_drop_pct: {
    min: 30,
    max: 90,
    step: 5,
    default: 70,
    unit: '%',
    label: 'Ngưỡng sụt giảm âm lượng loa',
  },

  // ── Nhóm 3b: Tham số cấp Nhà yến (BR-09f) ──
  return_rate_drop_pct: {
    min: 5,
    max: 50,
    step: 5,
    default: 20,
    unit: '%',
    label: 'Sụt giảm tỷ lệ chim về',
  },

} as const

export type TuningParamKey = keyof typeof TUNING_RANGES

/**
 * Giới hạn giá trị nằm trong dải [min, max] và làm tròn theo bước nhảy step.
 */
export function clampTuningValue(key: TuningParamKey, value: number): number {
  const config = TUNING_RANGES[key]
  if (!config) return value

  const clamped = Math.max(config.min, Math.min(config.max, value))
  const stepStr = config.step.toString()
  const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0

  return Number(clamped.toFixed(decimals))
}

/**
 * Kiểm tra xem một giá trị có nằm trong dải hợp lệ không.
 */
export function isWithinTuningRange(key: TuningParamKey, value: number): boolean {
  const config = TUNING_RANGES[key]
  if (!config) return false
  return value >= config.min && value <= config.max
}

/**
 * Đếm số lượng trường đã chỉnh sửa so với giá trị ban đầu.
 */
export function countDirtyFields<T>(
  current: T,
  initial: T
): number {
  const curr = current as unknown as Record<string, unknown>
  const init = initial as unknown as Record<string, unknown>
  let dirtyCount = 0
  for (const key of Object.keys(curr)) {
    if (curr[key] !== init[key]) {
      dirtyCount += 1
    }
  }
  return dirtyCount
}

/**
 * Trích xuất chỉ những trường có giá trị khác biệt so với ban đầu.
 */
export function getChangedFields<T>(
  current: T,
  initial: T
): Partial<T> {
  const curr = current as unknown as Record<string, unknown>
  const init = initial as unknown as Record<string, unknown>
  const changes: Record<string, unknown> = {}
  for (const key of Object.keys(curr)) {
    if (curr[key] !== init[key]) {
      changes[key] = curr[key]
    }
  }
  return changes as Partial<T>
}

export const DEFAULT_THRESHOLDS = {
  temp_min: TUNING_RANGES.temp_min.default,
  temp_max: TUNING_RANGES.temp_max.default,
  humidity_min: TUNING_RANGES.humidity_min.default,
  humidity_max: TUNING_RANGES.humidity_max.default,
  co2_max: TUNING_RANGES.co2_max.default,
  nh3_max: TUNING_RANGES.nh3_max.default,
  light_max: TUNING_RANGES.light_max.default,
}

export const DEFAULT_FUZZY = {
  fuzzy_humidity_band: TUNING_RANGES.fuzzy_humidity_band.default,
  fuzzy_temp_band: TUNING_RANGES.fuzzy_temp_band.default,
  fuzzy_fan_dry_level: TUNING_RANGES.fuzzy_fan_dry_level.default,
  fuzzy_window_sec: TUNING_RANGES.fuzzy_window_sec.default,
  fuzzy_input_filter: true,
}

export const DEFAULT_DETECTION = {
  noise_margin_db: TUNING_RANGES.noise_margin_db.default,
  noise_min_sec: TUNING_RANGES.noise_min_sec.default,
  pump_dry_on_sec: TUNING_RANGES.pump_dry_on_sec.default,
  pump_dry_min_rise_pct: TUNING_RANGES.pump_dry_min_rise_pct.default,
  speaker_drop_pct: TUNING_RANGES.speaker_drop_pct.default,
  return_rate_drop_pct: TUNING_RANGES.return_rate_drop_pct.default,
}

export interface TuningFieldConfig {
  key: TuningParamKey
  label: string
  unit: string
  min: number
  max: number
  step: number
  default: number
  decimals: number
}

export interface TuningCardConfig {
  id: string
  title: string
  description: string
  statusType?: 'good' | 'watch' | 'action'
  fields: TuningFieldConfig[]
}

/**
 * Metadata định nghĩa cấu trúc 4 Chip và các nhóm Card điều khiển tham số.
 * Giúp màn hình tuning render bằng .map() mà không bị phình to code.
 */
export const TUNING_GROUPS_METADATA: Record<'thresholds' | 'fuzzy' | 'detection', TuningCardConfig[]> = {
  thresholds: [
    {
      id: 'temp',
      title: 'Nhiệt độ an toàn',
      description: 'Dải nhiệt độ tối ưu cho chim yến làm tổ và ấp trứng (26°C – 31°C).',
      fields: [
        { ...TUNING_RANGES.temp_min, key: 'temp_min', decimals: 1 },
        { ...TUNING_RANGES.temp_max, key: 'temp_max', decimals: 1 },
      ],
    },
    {
      id: 'humidity',
      title: 'Độ ẩm an toàn',
      description: 'Kiểm soát hệ thống phun sương duy trì độ ẩm lý tưởng (75% – 85%).',
      fields: [
        { ...TUNING_RANGES.humidity_min, key: 'humidity_min', decimals: 0 },
        { ...TUNING_RANGES.humidity_max, key: 'humidity_max', decimals: 0 },
      ],
    },
    {
      id: 'gas_light',
      title: 'Giới hạn Khí độc & Ánh sáng',
      description: 'Cảnh báo nguy hại sức khỏe đàn yến do phân chim tích tụ hoặc lọt sáng.',
      fields: [
        { ...TUNING_RANGES.co2_max, key: 'co2_max', decimals: 0 },
        { ...TUNING_RANGES.nh3_max, key: 'nh3_max', decimals: 0 },
        { ...TUNING_RANGES.light_max, key: 'light_max', decimals: 1 },
      ],
    },
  ],
  fuzzy: [
    {
      id: 'fuzzy_tolerance',
      title: 'Độ nhạy bù ẩm & gió',
      description: 'Khoảng dao động cho phép trước khi máy phun sương hoặc quạt tự bật.',
      fields: [
        { ...TUNING_RANGES.fuzzy_humidity_band, key: 'fuzzy_humidity_band', decimals: 1 },
        { ...TUNING_RANGES.fuzzy_temp_band, key: 'fuzzy_temp_band', decimals: 1 },
      ],
    },
    {
      id: 'fuzzy_drying',
      title: 'Hút ẩm sàn & chu kỳ máy',
      description: 'Điều chỉnh quạt thông gió làm khô nền và nhịp đo đạc của thiết bị.',
      fields: [
        { ...TUNING_RANGES.fuzzy_fan_dry_level, key: 'fuzzy_fan_dry_level', decimals: 0 },
        { ...TUNING_RANGES.fuzzy_window_sec, key: 'fuzzy_window_sec', decimals: 0 },
      ],
    },
  ],
  detection: [
    {
      id: 'zone_anomaly',
      title: 'Sự cố vi khí hậu theo tầng',
      description: 'Bắt lỗi loa rè, bơm cạn nước và tiếng ồn lạ trong từng tầng.',
      fields: [
        { ...TUNING_RANGES.noise_margin_db, key: 'noise_margin_db', decimals: 0 },
        { ...TUNING_RANGES.noise_min_sec, key: 'noise_min_sec', decimals: 0 },
        { ...TUNING_RANGES.pump_dry_on_sec, key: 'pump_dry_on_sec', decimals: 0 },
        { ...TUNING_RANGES.pump_dry_min_rise_pct, key: 'pump_dry_min_rise_pct', decimals: 1 },
        { ...TUNING_RANGES.speaker_drop_pct, key: 'speaker_drop_pct', decimals: 0 },
      ],
    },
    {
      id: 'house_anomaly',
      title: 'Theo dõi đàn chim toàn nhà',
      description: 'Cảnh báo khi lượng chim về tổ giảm bất thường so với 7 ngày qua.',
      fields: [
        { ...TUNING_RANGES.return_rate_drop_pct, key: 'return_rate_drop_pct', decimals: 0 },
      ],
    },
  ],
}

