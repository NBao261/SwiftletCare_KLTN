import { describe, expect, it } from '@jest/globals'
import type { TelemetryRecord, Thresholds } from '@/types'
import { buildSensorTiles } from '@/utils/sensorTile.utils'

const thresholds: Thresholds = {
  temp_min: 26,
  temp_max: 31,
  humidity_min: 75,
  humidity_max: 95,
  light_max: 0.5,
  nh3_max: 25,
  co2_max: 1500,
}
const now = new Date('2026-10-31T10:00:00.000Z').getTime()

// Bản ghi mới 2 giây trước
function buildRecord(values: Partial<TelemetryRecord>): TelemetryRecord {
  return {
    _id: 'record-1',
    node_id: 'node-1',
    zone_id: 'zone-1',
    timestamp: new Date(now - 2000).toISOString(),
    is_anomaly: false,
    ...values,
  }
}

describe('buildSensorTiles', () => {
  it('đủ 6 ô theo thứ tự, số kèm đơn vị và khoảng ngưỡng', () => {
    const tiles = buildSensorTiles(
      buildRecord({ temperature: 29.84, humidity: 87, light_lux: 0.07, nh3_ppm: 12, co2_ppm: 1320, sound_db: 41 }),
      thresholds,
      now,
    )
    expect(tiles.map(tile => tile.metric)).toEqual(['temperature', 'humidity', 'light', 'nh3', 'co2', 'sound'])
    expect(tiles.map(tile => tile.valueText)).toEqual(['29,8°C', '87,0%', '0 lux', '12,0 ppm', '1.320 ppm', '41,0 dB'])
    expect(tiles[0].rangeText).toBe('26–31°C')
    expect(tiles[4]).toMatchObject({ numberText: '1.320', unitText: 'ppm' })
    expect(tiles[2].rangeText).toBe('< 0,5 lux')
    expect(tiles[4].rangeText).toBe('> 1.500 ppm')
    expect(tiles.map(tile => tile.isAlertOnly)).toEqual([false, false, false, true, true, false])
    expect(tiles[5].rangeText).toBeNull()
    expect(tiles.some(tile => tile.isOutOfRange)).toBe(false)
  })

  it('giữ đúng số backend trả, không làm tròn về số nguyên (69,9 không thành 70)', () => {
    expect(buildSensorTiles(buildRecord({ humidity: 69.9 }), thresholds, now)[1].valueText).toBe('69,9%')
  })

  it('ngoài ngưỡng thì đánh dấu; tiếng ồn không bao giờ ngoài ngưỡng', () => {
    const tiles = buildSensorTiles(buildRecord({ temperature: 33, co2_ppm: 1600, sound_db: 90 }), thresholds, now)
    expect(tiles.filter(tile => tile.isOutOfRange).map(tile => tile.metric)).toEqual(['temperature', 'co2'])
  })

  it('bản ghi thiếu một chỉ số là mất tín hiệu', () => {
    const humidity = buildSensorTiles(buildRecord({ temperature: 28 }), thresholds, now)[1]
    expect(humidity).toMatchObject({ valueText: '_', isSignalLost: true })
  })

  it('chưa có bản ghi thì mọi ô "_" và không báo mất tín hiệu', () => {
    const tiles = buildSensorTiles(null, thresholds, now)
    expect(tiles.every(tile => tile.valueText === '_' && !tile.isSignalLost)).toBe(true)
  })

  it('số đo cũ quá 5 phút thì không tô ngoài ngưỡng', () => {
    const stale = buildRecord({ temperature: 35, timestamp: new Date(now - 6 * 60 * 1000).toISOString() })
    expect(buildSensorTiles(stale, thresholds, now)[0].isOutOfRange).toBe(false)
  })
})
