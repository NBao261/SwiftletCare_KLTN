import { describe, expect, it } from '@jest/globals'
import type { BirdCountDay, EnvSeriesPoint } from '@/types'
import {
  averageReturnRate,
  buildEnvLine,
  compareWithPrevious,
  getAxisBounds,
  getDayWindows,
  getRangeDays,
  getThresholdBounds,
  groupBirdDays,
  pearson,
  summarizeValues,
} from '@/utils/analytics.utils'

// Một ngày đủ hai phiên, test nào cần thì sửa trường
function buildDay(date: string, overrides: Partial<BirdCountDay> = {}): BirdCountDay {
  return {
    date,
    morning_entry: 0,
    morning_exit: 1000,
    evening_entry: 950,
    evening_exit: 0,
    net_exit: 1000,
    net_entry: 950,
    return_rate: 95,
    has_morning: true,
    has_evening: true,
    ...overrides,
  }
}

function buildPoint(overrides: Partial<EnvSeriesPoint>): EnvSeriesPoint {
  return {
    timestamp: '2026-11-01T00:00:00.000Z',
    temperature: null,
    humidity: null,
    light_lux: null,
    nh3_ppm: null,
    co2_ppm: null,
    sound_db: null,
    anomalyCount: 0,
    sampleCount: 1,
    ...overrides,
  }
}

describe('averageReturnRate', () => {
  it('cộng chim về / chim ra của các ngày đủ phiên, bỏ ngày thiếu phiên', () => {
    const days = [
      buildDay('2026-10-30'),
      buildDay('2026-10-31', { net_exit: 1000, net_entry: 900, return_rate: 90 }),
      buildDay('2026-11-01', { has_evening: false, net_entry: 0, return_rate: null }),
    ]
    expect(averageReturnRate(days)).toBeCloseTo(92.5)
  })

  it('không ngày nào đủ phiên thì null', () => {
    expect(averageReturnRate([buildDay('2026-11-01', { has_morning: false, return_rate: null })])).toBeNull()
  })
})

describe('groupBirdDays', () => {
  const days = [
    buildDay('2026-10-26'),
    buildDay('2026-11-02', { net_exit: 500, net_entry: 400, return_rate: 80 }),
    buildDay('2026-10-27', { has_evening: false, return_rate: null, net_entry: 0 }),
  ]

  it('theo ngày: mỗi ngày một dòng, sắp theo ngày, đánh dấu ngày thiếu phiên', () => {
    const rows = groupBirdDays(days, 'day')
    expect(rows.map(row => row.key)).toEqual(['2026-10-26', '2026-10-27', '2026-11-02'])
    expect(rows[1]).toMatchObject({ isIncomplete: true, returnRate: null })
  })

  it('theo tuần ISO: 26 và 27/10 cùng tuần 44, 02/11 sang tuần 45', () => {
    const rows = groupBirdDays(days, 'week')
    expect(rows.map(row => row.key)).toEqual(['2026-W44', '2026-W45'])
    expect(rows[0]).toMatchObject({ exit: 2000, entry: 950, returnRate: 95, isIncomplete: true })
  })

  it('theo tháng', () => {
    expect(groupBirdDays(days, 'month').map(row => [row.key, row.returnRate])).toEqual([
      ['2026-10', 95],
      ['2026-11', 80],
    ])
  })
})

describe('getRangeDays và getDayWindows', () => {
  it('24 giờ là hôm nay, 7 ngày, 30 ngày', () => {
    expect([getRangeDays('24h'), getRangeDays('7d'), getRangeDays('30d')]).toEqual([1, 7, 30])
  })

  it('kỳ này bắt đầu 00:00 giờ Việt Nam, kỳ trước liền trước và cùng độ dài', () => {
    const now = Date.parse('2026-11-01T05:00:00.000Z') // 12:00 giờ Việt Nam
    const windows = getDayWindows(7, now)
    expect(windows.current.from).toBe('2026-10-25T17:00:00.000Z')
    expect(windows.previous.from).toBe('2026-10-18T17:00:00.000Z')
    expect(windows.previous.to).toBe('2026-10-25T16:59:59.999Z')
  })
})

describe('compareWithPrevious', () => {
  it('tăng, giảm, bằng; thiếu số thì null', () => {
    expect(compareWithPrevious(95, 90)).toBe('up')
    expect(compareWithPrevious(88, 90)).toBe('down')
    expect(compareWithPrevious(90.01, 90)).toBe('flat')
    expect(compareWithPrevious(null, 90)).toBeNull()
  })
})

describe('pearson', () => {
  it('cùng chiều là 1, ngược chiều là -1', () => {
    expect(
      pearson([
        [1, 2],
        [2, 4],
        [3, 6],
      ]),
    ).toBeCloseTo(1)
    expect(
      pearson([
        [1, 6],
        [2, 4],
        [3, 2],
      ]),
    ).toBeCloseTo(-1)
  })

  it('bỏ cặp thiếu số; dưới 3 cặp hoặc một bên không đổi thì null', () => {
    expect(
      pearson([
        [1, 2],
        [null, 4],
        [3, null],
      ]),
    ).toBeNull()
    expect(
      pearson([
        [1, 5],
        [2, 5],
        [3, 5],
      ]),
    ).toBeNull()
  })
})

describe('buildEnvLine', () => {
  const thresholds = {
    temp_min: 26,
    temp_max: 31,
    humidity_min: 75,
    humidity_max: 95,
    light_max: 0.5,
    nh3_max: 25,
    co2_max: 1500,
  }

  it('giữ đúng số lẻ của chỉ số, khung thiếu số là null, đánh dấu ngoài ngưỡng', () => {
    const series = [buildPoint({ humidity: 69.94 }), buildPoint({ humidity: null }), buildPoint({ humidity: 80 })]
    const line = buildEnvLine(series, 'humidity', getThresholdBounds('humidity', thresholds))
    expect(line.map(point => point.value)).toEqual([69.9, null, 80])
    expect(line.map(point => point.isOutOfRange)).toEqual([true, false, false])
  })

  it('CO2 không có số lẻ và chỉ có mức cao; tiếng ồn không có ngưỡng', () => {
    const line = buildEnvLine([buildPoint({ co2_ppm: 1600.4 })], 'co2', getThresholdBounds('co2', thresholds))
    expect(line[0]).toMatchObject({ value: 1600, isOutOfRange: true })
    expect(getThresholdBounds('sound', thresholds)).toEqual({})
  })
})

describe('summarizeValues và getAxisBounds', () => {
  it('bỏ số thiếu khi tìm thấp nhất, cao nhất', () => {
    expect(summarizeValues([72, null, 93])).toEqual({ min: 72, max: 93 })
    expect(summarizeValues([null])).toBeNull()
  })

  it('trục gồm cả ngưỡng và nới hai đầu', () => {
    expect(getAxisBounds([80, 90], [75, 95])).toEqual({ base: 73, top: 97 })
  })
})
