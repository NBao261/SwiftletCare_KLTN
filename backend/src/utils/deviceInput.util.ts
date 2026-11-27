import { THRESHOLD_LIMITS } from '@/utils/thresholds.util'
import { LIMITS } from '@/utils/inputRules.util'
import type { TelemetryPayload } from '@/types'

// Tin từ thiết bị không đáng tin: giá trị sai kiểu hoặc ngoài khoảng được coi là thiếu, không làm hỏng cả tin

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const inRange = (v: unknown, min: number, max: number): v is number => isFiniteNumber(v) && v >= min && v <= max

// Khoảng số đo còn tin được; độ ẩm tới 101 % vì cảm biến dung sai lúc bão hoà (Report 3 §4.5)
export const SENSOR_RANGE = {
  temperature: { min: THRESHOLD_LIMITS.temp_max.min, max: THRESHOLD_LIMITS.temp_max.max },
  humidity:    { min: 0, max: 101 },
  light_lux:   { min: 0, max: THRESHOLD_LIMITS.light_max.max },
  nh3_ppm:     { min: 0, max: THRESHOLD_LIMITS.nh3_max.max },
  co2_ppm:     { min: 0, max: THRESHOLD_LIMITS.co2_max.max },
  sound_db:    { min: 0, max: 140 },
} as const

const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

// Trả bản sao: trường sai kiểu hoặc ngoài khoảng thành undefined (vào stale_fields), không đổi tin gốc
export function sanitizeTelemetry(raw: TelemetryPayload): TelemetryPayload {
  const clean: Record<string, unknown> = { deviceId: raw.deviceId, timestamp: raw.timestamp, buffered: raw.buffered }
  for (const [field, { min, max }] of Object.entries(SENSOR_RANGE)) {
    const value = (raw as unknown as Record<string, unknown>)[field]
    clean[field] = inRange(value, min, max) ? value : undefined
  }
  // Dòng âm là số đo lỗi (shunt một chiều)
  clean.pump_current_a = isFiniteNumber(raw.pump_current_a) && raw.pump_current_a >= 0 ? raw.pump_current_a : undefined
  clean.fan_current_a = isFiniteNumber(raw.fan_current_a) && raw.fan_current_a >= 0 ? raw.fan_current_a : undefined
  clean.control_mode = raw.control_mode === 'MANUAL' ? 'MANUAL' : 'AUTO'
  const states = raw.relay_states as unknown as Record<string, unknown> | undefined
  if (states && typeof states === 'object') {
    clean.relay_states = { misting: bool(states.misting), ventilation: bool(states.ventilation), speaker: bool(states.speaker) }
  }
  const output = raw.control_output as unknown as Record<string, unknown> | undefined
  if (output && typeof output === 'object') {
    clean.control_output = {
      misting: inRange(output.misting, 0, 100) ? output.misting : undefined,
      ventilation: inRange(output.ventilation, 0, 100) ? output.ventilation : undefined,
    }
  }
  return clean as unknown as TelemetryPayload
}

export interface HeartbeatBasics { rssi?: number; firmwareVersion?: string; modelVersion?: string; fps?: number }

// Chỉ giữ giá trị đúng kiểu và trong khoảng
export function parseHeartbeatBasics(raw: Record<string, unknown>): HeartbeatBasics {
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined)
  return {
    rssi: inRange(raw.rssi, -127, 0) ? raw.rssi : undefined,
    firmwareVersion: text(raw.firmwareVersion, LIMITS.firmwareVersion),
    modelVersion: text(raw.modelVersion, LIMITS.modelVersion),
    fps: inRange(raw.fps, 0, 1000) ? raw.fps : undefined,
  }
}

// Thời gian còn lại thiết bị báo không được kéo hạn ghi đè quá mức tối đa
export function clampRemainingMs(value: unknown, maxMs: number): number | undefined {
  return isFiniteNumber(value) && value > 0 ? Math.min(value, maxMs) : undefined
}

const HTTP_URL = /^https?:\/\/\S+$/i

// Nội dung do thiết bị gửi: chuỗi vừa phải, link http(s); dữ liệu thô quá lớn thì không lưu
export function parseDeviceAlertText(message: Record<string, unknown>): { text?: string; snapshotUrl?: string; raw: Record<string, unknown> } {
  const text = typeof message.message === 'string' && message.message.trim() && message.message.length <= LIMITS.alertMessage
    ? message.message : undefined
  const url = message.snapshotUrl
  const snapshotUrl = typeof url === 'string' && url.length <= LIMITS.url && HTTP_URL.test(url) ? url : undefined
  const raw = JSON.stringify(message).length <= LIMITS.alertRawBytes ? message : { truncated: true }
  return { text, snapshotUrl, raw }
}

const MAX_BACKDATE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

// Mốc thời gian của thiết bị chưa đồng bộ giờ (còn ở năm 1970 hoặc quá xa): ngoài khoảng thì undefined
export function plausibleTime(value: unknown, now: number, oldest = now - MAX_BACKDATE_MS): number | undefined {
  return isFiniteNumber(value) && value >= oldest && value <= now + MAX_CLOCK_SKEW_MS ? value : undefined
}

// Số đếm chim tới trễ vẫn nhận; chỉ loại giờ trước khi dự án chạy (đồng hồ chưa đồng bộ)
export const BIRD_COUNT_EPOCH_MS = Date.UTC(2025, 0, 1)

export const isBirdCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= LIMITS.maxBirdCount
export const validConfidence = (v: unknown): v is number => inRange(v, 0, 1)
