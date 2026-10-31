import { BadRequestError } from '@/utils/appError.util'
import { toNumber } from '@/utils/thresholds.util'
import type { BirdCountTuning, DetectionTuning, HealthLevels } from '@/types'

/**
 * EXPERT-FR-008 — tham số phát hiện Domain Expert chỉnh. Mặc định là các hằng số dùng trước
 * SRS v2.1.0; khoảng hợp lệ là giới hạn kỹ thuật (tránh nhập nhầm làm tắt hẳn việc phát hiện),
 * không phải khuyến nghị nuôi yến.
 * - Theo Zone: năm tham số chạy trên ESP32 — mặc định và khoảng phải khớp firmware `Config.h` /
 *   `Config::update()` (nó kẹp lại lần nữa).
 * - Theo House (SRS v2.1.8): mức giảm tỷ lệ chim về — chim ra vào ở cửa của cả nhà, backend dùng.
 * Tách file riêng vì houseZone.model import mặc định ở đây làm default schema.
 */
type Limits<T> = Record<keyof T, { min: number; max: number; unit: string; integer?: boolean }>

export const DETECTION_TUNING_KEYS = [
  'noise_margin_db', 'noise_min_sec', 'pump_dry_on_sec', 'pump_dry_min_rise_pct', 'speaker_drop_pct',
] as const satisfies ReadonlyArray<keyof DetectionTuning>

export const DEFAULT_DETECTION_TUNING: DetectionTuning = {
  noise_margin_db: 15,
  noise_min_sec: 10,
  pump_dry_on_sec: 300,
  pump_dry_min_rise_pct: 2,
  speaker_drop_pct: 70,
}

export const DETECTION_TUNING_LIMITS: Limits<DetectionTuning> = {
  noise_margin_db:       { min: 5,   max: 30,  unit: 'dB' },
  noise_min_sec:         { min: 5,   max: 15,  unit: 'giây', integer: true },
  pump_dry_on_sec:       { min: 120, max: 900, unit: 'giây', integer: true },
  pump_dry_min_rise_pct: { min: 0.5, max: 10,  unit: '%RH' },
  speaker_drop_pct:      { min: 30,  max: 90,  unit: '%', integer: true },
}

export const BIRD_COUNT_TUNING_KEYS = ['return_rate_drop_pct'] as const satisfies ReadonlyArray<keyof BirdCountTuning>

export const DEFAULT_BIRD_COUNT_TUNING: BirdCountTuning = { return_rate_drop_pct: 20 }

export const BIRD_COUNT_TUNING_LIMITS: Limits<BirdCountTuning> = {
  return_rate_drop_pct: { min: 5, max: 50, unit: '%' },
}

/** Chỉ giữ các khoá tham số — chặn body chèn field lạ; số không hợp lệ thành NaN để assert từ chối */
function pick<T>(keys: ReadonlyArray<keyof T>, input: Record<string, unknown>): Partial<T> {
  const picked: Partial<T> = {}
  for (const key of keys) {
    if (input[key as string] !== undefined) picked[key] = toNumber(input[key as string]) as T[keyof T]
  }
  return picked
}

function assertValid<T>(keys: ReadonlyArray<keyof T>, limits: Limits<T>, t: T): void {
  for (const key of keys) {
    const { min, max, unit, integer } = limits[key]
    const value = t[key] as unknown as number
    if (!Number.isFinite(value)) throw BadRequestError(`${String(key)} phải là một số hợp lệ`)
    if (value < min || value > max) throw BadRequestError(`${String(key)} phải nằm trong khoảng ${min}–${max} ${unit}`)
    if (integer && !Number.isInteger(value)) throw BadRequestError(`${String(key)} phải là số nguyên`)
  }
}

/** Bản ghi tạo trước khi có tham số (hoặc thiếu trường) → dùng mặc định */
function resolve<T>(keys: ReadonlyArray<keyof T>, defaults: T, saved?: Partial<T> | null): T {
  const resolved = { ...defaults }
  for (const key of keys) {
    const value = saved?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) resolved[key] = value as T[keyof T]
  }
  return resolved
}

export const pickDetectionTuning = (input: Record<string, unknown>) => pick<DetectionTuning>(DETECTION_TUNING_KEYS, input)
export const assertValidDetectionTuning = (t: DetectionTuning) => assertValid(DETECTION_TUNING_KEYS, DETECTION_TUNING_LIMITS, t)
export const resolveDetectionTuning = (saved?: Partial<DetectionTuning> | null) =>
  resolve(DETECTION_TUNING_KEYS, DEFAULT_DETECTION_TUNING, saved)

export const pickBirdCountTuning = (input: Record<string, unknown>) => pick<BirdCountTuning>(BIRD_COUNT_TUNING_KEYS, input)
export const assertValidBirdCountTuning = (t: BirdCountTuning) => assertValid(BIRD_COUNT_TUNING_KEYS, BIRD_COUNT_TUNING_LIMITS, t)
export const resolveBirdCountTuning = (saved?: Partial<BirdCountTuning> | null) =>
  resolve(BIRD_COUNT_TUNING_KEYS, DEFAULT_BIRD_COUNT_TUNING, saved)

/**
 * BR-28 — mức của chỉ số sức khỏe theo House. Mặc định là hằng số kỹ thuật (A-4, Report 3 §4.5);
 * khoảng là khoảng BR-28 cho Domain Expert đặt.
 */
export const HEALTH_LEVEL_KEYS = [
  'in_range_slight_pct', 'in_range_clear_pct', 'air_slight_h', 'air_clear_h', 'noise_slight', 'noise_clear',
] as const satisfies ReadonlyArray<keyof HealthLevels>

export const DEFAULT_HEALTH_LEVELS: HealthLevels = {
  in_range_slight_pct: 90,
  in_range_clear_pct: 75,
  air_slight_h: 1,
  air_clear_h: 4,
  noise_slight: 1,
  noise_clear: 3,
}

export const HEALTH_LEVEL_LIMITS: Limits<HealthLevels> = {
  in_range_slight_pct: { min: 50,  max: 100, unit: '%' },
  in_range_clear_pct:  { min: 50,  max: 100, unit: '%' },
  air_slight_h:        { min: 0.5, max: 12,  unit: 'giờ' },
  air_clear_h:         { min: 0.5, max: 12,  unit: 'giờ' },
  noise_slight:        { min: 1,   max: 10,  unit: 'đợt', integer: true },
  noise_clear:         { min: 1,   max: 10,  unit: 'đợt', integer: true },
}

export const pickHealthLevels = (input: Record<string, unknown>) => pick<HealthLevels>(HEALTH_LEVEL_KEYS, input)
export const resolveHealthLevels = (saved?: Partial<HealthLevels> | null) =>
  resolve(HEALTH_LEVEL_KEYS, DEFAULT_HEALTH_LEVELS, saved)
/** Ngoài khoảng, hoặc mức CLEAR nhẹ hơn mức SLIGHT (CLEAR sẽ không bao giờ xảy ra trước SLIGHT) → 400 */
export function assertValidHealthLevels(t: HealthLevels): void {
  assertValid(HEALTH_LEVEL_KEYS, HEALTH_LEVEL_LIMITS, t)
  if (t.in_range_clear_pct > t.in_range_slight_pct) throw BadRequestError('in_range_clear_pct không được lớn hơn in_range_slight_pct')
  if (t.air_clear_h < t.air_slight_h) throw BadRequestError('air_clear_h không được nhỏ hơn air_slight_h')
  if (t.noise_clear < t.noise_slight) throw BadRequestError('noise_clear không được nhỏ hơn noise_slight')
}

/** Phần gửi xuống ESP32 qua config/update — tên field = tên key MQTT */
export function firmwareDetectionConfig(t: DetectionTuning): DetectionTuning {
  return Object.fromEntries(DETECTION_TUNING_KEYS.map(key => [key, t[key]])) as unknown as DetectionTuning
}
