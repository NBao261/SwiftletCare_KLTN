import { describe, expect, it } from '@jest/globals'
import type { TelemetryRecord, Thresholds } from '@/types'
import { getBreachedMetrics, isRecentReading } from '@/utils/threshold.utils'

const thresholds: Thresholds = {
  temp_min: 26,
  temp_max: 31,
  humidity_min: 75,
  humidity_max: 95,
  light_max: 0.2,
  nh3_max: 25,
  co2_max: 1500,
}

const baseRecord: TelemetryRecord = {
  _id: 'record-1',
  node_id: 'node-1',
  zone_id: 'zone-1',
  timestamp: '2026-10-30T10:00:00.000Z',
  temperature: 28,
  humidity: 85,
  light_lux: 0.1,
  nh3_ppm: 10,
  co2_ppm: 800,
  is_anomaly: false,
}

describe('getBreachedMetrics', () => {
  it('mọi số đo trong ngưỡng thì không có chỉ số nào', () => {
    expect(getBreachedMetrics(baseRecord, thresholds)).toEqual([])
  })

  it('bắt cả dưới min và trên max', () => {
    const record = { ...baseRecord, temperature: 32, humidity: 70, co2_ppm: 1600 }
    expect(getBreachedMetrics(record, thresholds)).toEqual(['temperature', 'humidity', 'co2'])
  })

  it('đúng bằng ngưỡng vẫn là trong ngưỡng', () => {
    const record = { ...baseRecord, temperature: 31, nh3_ppm: 25 }
    expect(getBreachedMetrics(record, thresholds)).toEqual([])
  })

  it('thiếu số đo thì không tính là lệch', () => {
    const record = { ...baseRecord, temperature: undefined, light_lux: undefined }
    expect(getBreachedMetrics(record, thresholds)).toEqual([])
  })
})

describe('isRecentReading', () => {
  const now = new Date('2026-10-30T10:00:00.000Z').getTime()

  it('số đo trong 5 phút gần nhất là còn mới', () => {
    expect(isRecentReading({ ...baseRecord, timestamp: '2026-10-30T09:56:00.000Z' }, now)).toBe(true)
  })

  it('số đo cũ hơn 5 phút thì bỏ qua', () => {
    expect(isRecentReading({ ...baseRecord, timestamp: '2026-10-30T09:54:00.000Z' }, now)).toBe(false)
  })
})
