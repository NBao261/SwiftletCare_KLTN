import {
  clampRemainingMs, isBirdCount, parseDeviceAlertText, parseHeartbeatBasics, plausibleTime, sanitizeTelemetry, validConfidence,
} from '@/utils/deviceInput.util'
import type { TelemetryPayload } from '@/types'

const sample = (override: Record<string, unknown> = {}) => ({
  deviceId: 'n1', temperature: 29, humidity: 85, light_lux: 0.1, nh3_ppm: 5, co2_ppm: 800, sound_db: 40,
  relay_states: { misting: true, ventilation: false, speaker: false }, control_mode: 'AUTO', timestamp: 1, ...override,
}) as unknown as TelemetryPayload

describe('sanitizeTelemetry', () => {
  it('số đo hợp lệ giữ nguyên', () => {
    expect(sanitizeTelemetry(sample())).toMatchObject({ temperature: 29, humidity: 85, nh3_ppm: 5, co2_ppm: 800 })
  })

  it.each([
    ['độ ẩm 9999', { humidity: 9999 }, 'humidity'],
    ['nhiệt độ −500', { temperature: -500 }, 'temperature'],
    ['NH3 là chuỗi', { nh3_ppm: '12' }, 'nh3_ppm'],
    ['CO2 NaN', { co2_ppm: NaN }, 'co2_ppm'],
    ['tiếng ồn 500 dB', { sound_db: 500 }, 'sound_db'],
  ])('%s → trường đó thành thiếu, trường khác giữ', (_label, override, field) => {
    const clean = sanitizeTelemetry(sample(override)) as unknown as Record<string, unknown>
    expect(clean[field]).toBeUndefined()
    expect(clean.temperature === undefined).toBe(field === 'temperature')
  })

  it('khí và ánh sáng vượt tầm đo được giữ ở mức cực đại để cảnh báo vẫn bắn', () => {
    const clean = sanitizeTelemetry(sample({ nh3_ppm: 900, co2_ppm: 99999, light_lux: 10 ** 7, humidity: 150 }))
    expect(clean).toMatchObject({ nh3_ppm: 500, co2_ppm: 5000, light_lux: 200_000 })
    expect(clean.humidity).toBeUndefined()
    expect(sanitizeTelemetry(sample({ nh3_ppm: -1 })).nh3_ppm).toBeUndefined()
  })

  it('độ ẩm 101 % (sai số lúc bão hoà) vẫn nhận', () => {
    expect(sanitizeTelemetry(sample({ humidity: 101 })).humidity).toBe(101)
  })

  it('trạng thái relay sai kiểu thành thiếu; chế độ lạ thành AUTO', () => {
    const clean = sanitizeTelemetry(sample({ relay_states: { misting: 'yes', ventilation: true }, control_mode: 'HACK' }))
    expect(clean.relay_states.misting).toBeUndefined()
    expect(clean.relay_states.ventilation).toBe(true)
    expect(clean.control_mode).toBe('AUTO')
  })

  it('relay_states không phải object không làm hỏng tin', () => {
    expect(() => sanitizeTelemetry(sample({ relay_states: 'on', control_output: 5 }))).not.toThrow()
  })

  it('dòng âm thành thiếu; công suất ngoài 0–100 % thành thiếu', () => {
    const clean = sanitizeTelemetry(sample({ pump_current_a: -1, control_output: { misting: 150, ventilation: 40 } }))
    expect(clean.pump_current_a).toBeUndefined()
    expect(clean.control_output).toMatchObject({ ventilation: 40 })
    expect(clean.control_output?.misting).toBeUndefined()
  })
})

describe('parseHeartbeatBasics', () => {
  it('giá trị đúng được giữ', () => {
    expect(parseHeartbeatBasics({ rssi: -60, firmwareVersion: '2.4.0', modelVersion: 'yolov8n', fps: 12 }))
      .toEqual({ rssi: -60, firmwareVersion: '2.4.0', modelVersion: 'yolov8n', fps: 12 })
  })

  it('sai kiểu hoặc ngoài khoảng thì bỏ', () => {
    expect(parseHeartbeatBasics({ rssi: 'abc', firmwareVersion: 'x'.repeat(33), modelVersion: 7, fps: 5000 }))
      .toEqual({ rssi: undefined, firmwareVersion: undefined, modelVersion: undefined, fps: undefined })
  })

  it('RSSI dương là sai', () => {
    expect(parseHeartbeatBasics({ rssi: 10 }).rssi).toBeUndefined()
  })
})

describe('clampRemainingMs', () => {
  it('kẹp về mức tối đa', () => expect(clampRemainingMs(10 ** 12, 86_400_000)).toBe(86_400_000))
  it('giá trị nhỏ giữ nguyên', () => expect(clampRemainingMs(5000, 86_400_000)).toBe(5000))
  it.each([[0], [-1], ['5'], [NaN], [undefined]])('%p thành thiếu', value => expect(clampRemainingMs(value, 100)).toBeUndefined())
})

describe('parseDeviceAlertText', () => {
  it('nhận nội dung, link https và giữ dữ liệu thô nhỏ', () => {
    const message = { message: 'Quạt lỗi', snapshotUrl: 'https://x.vn/a.jpg' }
    expect(parseDeviceAlertText(message)).toEqual({ text: 'Quạt lỗi', snapshotUrl: 'https://x.vn/a.jpg', raw: message })
  })

  it('nội dung sai kiểu hoặc quá dài, link không phải http(s) thì bỏ', () => {
    const parsed = parseDeviceAlertText({ message: { a: 1 }, snapshotUrl: 'javascript:alert(1)' })
    expect(parsed.text).toBeUndefined()
    expect(parsed.snapshotUrl).toBeUndefined()
    expect(parseDeviceAlertText({ message: 'x'.repeat(501) }).text).toBeUndefined()
  })

  it('dữ liệu thô quá 8 KB không được lưu', () => {
    expect(parseDeviceAlertText({ note: 'x'.repeat(9000) }).raw).toEqual({ truncated: true })
  })
})

describe('mốc thời gian và số đếm', () => {
  const now = Date.UTC(2026, 10, 28, 12)
  it('trong khoảng thì nhận', () => expect(plausibleTime(now - 3600_000, now)).toBe(now - 3600_000))
  it('quá 7 ngày trước thì bỏ', () => expect(plausibleTime(now - 8 * 86_400_000, now)).toBeUndefined())
  it('quá 5 phút sau thì bỏ', () => expect(plausibleTime(now + 10 * 60_000, now)).toBeUndefined())
  it('không phải số thì bỏ', () => expect(plausibleTime('abc', now)).toBeUndefined())

  it('số đếm nguyên từ 0 tới 1 000 000', () => {
    expect(isBirdCount(0)).toBe(true)
    expect(isBirdCount(1_000_000)).toBe(true)
    expect(isBirdCount(1_000_001)).toBe(false)
    expect(isBirdCount(1.5)).toBe(false)
    expect(isBirdCount(-1)).toBe(false)
  })

  it('độ tin cậy 0–1', () => {
    expect(validConfidence(0.8)).toBe(true)
    expect(validConfidence(1.2)).toBe(false)
    expect(validConfidence('0.5')).toBe(false)
  })
})
