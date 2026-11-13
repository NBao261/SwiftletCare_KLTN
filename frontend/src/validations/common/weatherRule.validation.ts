import type { WeatherRule } from '@/types/expert.types'

// Giới hạn theo API spec ENV-FR-030, BR-38
const METRIC_MIN_RANGE: Record<WeatherRule['metric'], { min: number; max: number; label: string; unit: string }> = {
  temperature: { min: 0, max: 50, label: 'Nhiệt độ cao nhất', unit: '°C' },
  humidity:    { min: 0, max: 100, label: 'Độ ẩm ngoài trời cao nhất', unit: '%' },
  rain:        { min: 0.1, max: 50, label: 'Tổng mưa', unit: 'mm' },
}

export interface WeatherRuleErrors {
  metric?: string
  min?: string
  offset_pct?: string
  duration_min?: string
}

export function validateWeatherRule(rule: Partial<WeatherRule>): WeatherRuleErrors {
  const errors: WeatherRuleErrors = {}

  if (!rule.metric) {
    errors.metric = 'Chọn chỉ số thời tiết'
  }

  if (rule.metric) {
    const range = METRIC_MIN_RANGE[rule.metric]
    if (rule.min === undefined || rule.min === null || isNaN(rule.min)) {
      errors.min = `Nhập ngưỡng ${range.label} (${range.min}…${range.max} ${range.unit})`
    } else if (rule.min < range.min || rule.min > range.max) {
      errors.min = `${range.label} phải trong khoảng ${range.min}…${range.max} ${range.unit}`
    }
  }

  if (rule.offset_pct === undefined || rule.offset_pct === null || isNaN(rule.offset_pct)) {
    errors.offset_pct = 'Nhập mức bù (−10…+10, khác 0)'
  } else if (rule.offset_pct < -10 || rule.offset_pct > 10) {
    errors.offset_pct = 'Mức bù phải trong khoảng −10…+10 điểm %'
  } else if (rule.offset_pct === 0) {
    errors.offset_pct = 'Mức bù không được bằng 0'
  }

  if (rule.duration_min === undefined || rule.duration_min === null || isNaN(rule.duration_min)) {
    errors.duration_min = 'Nhập thời hạn (1…120 phút)'
  } else if (rule.duration_min < 1 || rule.duration_min > 120) {
    errors.duration_min = 'Thời hạn phải trong khoảng 1…120 phút'
  }

  return errors
}

export function isWeatherRuleValid(rule: Partial<WeatherRule>): boolean {
  return Object.keys(validateWeatherRule(rule)).length === 0
}

export { METRIC_MIN_RANGE }
