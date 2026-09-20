import { BadRequestError } from '@/utils/appError.util'
import type { Thresholds } from '@/types'

export const THRESHOLD_KEYS = [
  'temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'light_max', 'nh3_max', 'co2_max',
] as const satisfies ReadonlyArray<keyof Thresholds>

/**
 * ENV-FR-007 — giá trị gốc khi Admin chưa từng cấu hình `system_settings`.
 * Phải khớp firmware/src/config/Config.h (DEFAULT_TEMP_MIN...DEFAULT_CO2_MAX)
 * và default của schema Zone.thresholds, nếu không thiết bị mới và Zone mới sẽ
 * chạy theo 2 bộ ngưỡng khác nhau.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  temp_min: 26.0,
  temp_max: 31.0,
  humidity_min: 75.0,
  humidity_max: 95.0,
  light_max: 0.2,
  nh3_max: 25,
  co2_max: 1500,
}

export function assertValidThresholds(t: Thresholds): void {
  if (t.temp_min >= t.temp_max) throw BadRequestError('temp_min phải nhỏ hơn temp_max')
  if (t.humidity_min >= t.humidity_max) throw BadRequestError('humidity_min phải nhỏ hơn humidity_max')
  if (t.light_max < 0 || t.nh3_max < 0 || t.co2_max < 0) {
    throw BadRequestError('light_max/nh3_max/co2_max không được âm')
  }
}

/** Chỉ giữ 7 khoá ngưỡng hợp lệ — chặn body chèn thêm field lạ vào document */
export function pickThresholds(input: Record<string, unknown>): Partial<Thresholds> {
  const picked: Partial<Thresholds> = {}
  for (const key of THRESHOLD_KEYS) {
    if (input[key] !== undefined) picked[key] = Number(input[key])
  }
  return picked
}
