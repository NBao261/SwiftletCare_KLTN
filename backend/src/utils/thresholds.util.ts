import { BadRequestError } from '@/utils/appError.util'
import type { Thresholds } from '@/types'

export const THRESHOLD_KEYS = [
  'temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'light_max', 'nh3_max', 'co2_max',
] as const satisfies ReadonlyArray<keyof Thresholds>

/**
 * ENV-FR-007 — giá trị gốc khi Admin chưa từng cấu hình `system_settings`.
 * Phải khớp firmware/src/config/Config.h (DEFAULT_TEMP_MIN...DEFAULT_CO2_MAX).
 * Schema Zone.thresholds lấy default trực tiếp từ đây nên chỉ còn 1 nguồn phía backend.
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

/**
 * Khoảng đo của cảm biến thật (SRS §7.1, BOM v3.1): SHT35 nhiệt −40..125°C và ẩm
 * 0..100%RH, ES-ALS-02 0..200.000 lux, ES-NH3-01 0..500 ppm, ES-CO2-01 0..5000 ppm.
 * Ngưỡng nằm ngoài khoảng này không bao giờ kích hoạt được (hoặc luôn kích hoạt),
 * nên bị từ chối thay vì lưu và lan sang mọi zone mới (Flow 22 bước 2a).
 */
export const THRESHOLD_LIMITS: Record<keyof Thresholds, { min: number; max: number; unit: string }> = {
  temp_min:     { min: -40, max: 125,     unit: '°C' },
  temp_max:     { min: -40, max: 125,     unit: '°C' },
  humidity_min: { min: 0,   max: 100,     unit: '%' },
  humidity_max: { min: 0,   max: 100,     unit: '%' },
  light_max:    { min: 0,   max: 200_000, unit: 'lux' },
  nh3_max:      { min: 0,   max: 500,     unit: 'ppm' },
  co2_max:      { min: 0,   max: 5000,    unit: 'ppm' },
}

export function assertValidThresholds(t: Thresholds): void {
  // Number(): giá trị ghép từ body có thể còn là chuỗi số ("30") — Mongoose vẫn ép được khi lưu
  for (const key of THRESHOLD_KEYS) {
    if (!Number.isFinite(Number(t[key]))) throw BadRequestError(`${key} phải là một số hợp lệ`)
  }
  if (t.temp_min >= t.temp_max) throw BadRequestError('temp_min phải nhỏ hơn temp_max')
  if (t.humidity_min >= t.humidity_max) throw BadRequestError('humidity_min phải nhỏ hơn humidity_max')
  if (t.light_max < 0 || t.nh3_max < 0 || t.co2_max < 0) {
    throw BadRequestError('light_max/nh3_max/co2_max không được âm')
  }
  for (const key of THRESHOLD_KEYS) {
    const { min, max, unit } = THRESHOLD_LIMITS[key]
    const value = Number(t[key])
    if (value < min || value > max) {
      throw BadRequestError(`${key} phải nằm trong khoảng ${min}–${max} ${unit} (khoảng đo của cảm biến)`)
    }
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
