import { describe, expect, it } from '@jest/globals'
import type { HealthReason, HouseHealthDay } from '@/types'
import {
  formatHealthReason,
  formatIndicatorValue,
  formatLastRatingDay,
  getOldestPendingDay,
  getPendingRatingRange,
  isHealthDayHidden,
  shiftDate,
  summarizePendingTasks,
} from '@/utils/healthDay.utils'

// Ngày tối thiểu cho test; mặc định còn chờ chấm (bị che, BR-31)
function buildDay(houseId: string, date: string, overrides: Partial<HouseHealthDay> = {}): HouseHealthDay {
  return {
    _id: `${houseId}-${date}`,
    house_id: houseId,
    house_name: houseId,
    farm_id: 'farm-1',
    date,
    weather: null,
    my_rating_state: 'PENDING',
    rating_deadline: `${date}T17:00:00.000Z`,
    ...overrides,
  }
}

function reason(code: HealthReason['code'], values: Record<string, unknown> = {}, extra: Partial<HealthReason> = {}): HealthReason {
  return { code, source: null, level: null, values, ...extra }
}

describe('summarizePendingTasks', () => {
  it('tổng là số việc, không phải số loại việc', () => {
    const summary = summarizePendingTasks([buildDay('house-a', '2026-10-29'), buildDay('house-b', '2026-10-29')], 1)
    expect(summary.total).toBe(3)
    expect(summary.summary).toBe('2 nhà chờ đánh giá ngày · 1 cảnh báo chờ phán quyết')
  })

  it('đếm nhà một lần dù nhà có nhiều ngày chờ', () => {
    const summary = summarizePendingTasks([buildDay('house-a', '2026-10-28'), buildDay('house-a', '2026-10-29')], 0)
    expect(summary).toEqual({ total: 2, summary: '1 nhà chờ đánh giá ngày' })
  })

  it('chỉ có cảnh báo chờ phán quyết', () => {
    expect(summarizePendingTasks([], 2)).toEqual({ total: 2, summary: '2 cảnh báo chờ phán quyết' })
  })

  it('không có việc thì tổng 0 và câu rỗng', () => {
    expect(summarizePendingTasks([], 0)).toEqual({ total: 0, summary: '' })
  })
})

describe('formatHealthReason', () => {
  it('lý do một chỉ số lệch kèm mức viết thường', () => {
    expect(
      formatHealthReason(reason('ENV_IN_RANGE', { zone_name: 'Tầng 1', in_range_pct: 62.5 }, { source: 'environment', level: 'SLIGHT' })),
    ).toBe('Môi trường: Tầng 1 chỉ 62,5 % thời gian nhiệt độ, độ ẩm trong ngưỡng (lệch nhẹ)')
    expect(formatHealthReason(reason('AIR_OVER_LIMIT', { zone_name: 'Tầng 2', hours: 3 }, { source: 'air', level: 'CLEAR' }))).toBe(
      'Không khí: NH3 hoặc CO2 vượt ngưỡng 3 giờ ở Tầng 2 (lệch rõ)',
    )
    expect(formatHealthReason(reason('NOISE_EPISODES', { episodes: 4 }, { source: 'noise', level: 'SLIGHT' }))).toBe(
      'Tiếng ồn: 4 đợt ồn bất thường (lệch nhẹ)',
    )
  })

  it('đàn chim giảm', () => {
    const text = formatHealthReason(
      reason('FLOCK_DROP', { return_rate: 71.2, drop_pct: 18, baseline_avg: 86.8, baseline_days: 5 }, { source: 'flock', level: 'CLEAR' }),
    )
    expect(text).toBe('Đàn chim: tỷ lệ chim về 71,2 %, giảm 18 % so với trung bình 5 ngày trước (86,8 %) (lệch rõ)')
  })

  it('thiếu dữ liệu theo nguồn và số liệu', () => {
    expect(formatHealthReason(reason('MISSING_DATA', { missing: 'EVENING' }, { source: 'flock' }))).toBe(
      'Thiếu dữ liệu đàn chim: thiếu phiên chiều',
    )
    expect(formatHealthReason(reason('MISSING_DATA', { missing: 'NO_DEPARTURES' }, { source: 'flock' }))).toBe(
      'Thiếu dữ liệu đàn chim: phiên sáng không có chim ra',
    )
    expect(formatHealthReason(reason('MISSING_DATA', { missing: 'MORNING' }, { source: 'flock' }))).toBe(
      'Thiếu dữ liệu đàn chim: thiếu phiên sáng',
    )
    expect(formatHealthReason(reason('MISSING_DATA', { no_zones: true }, { source: 'environment' }))).toBe(
      'Thiếu dữ liệu môi trường: nhà chưa có Zone',
    )
    expect(
      formatHealthReason(
        reason('MISSING_DATA', { min_pct: 80, zones: [{ zone_name: 'Tầng 1', valid_pct: 41.5 }] }, { source: 'environment' }),
      ),
    ).toBe('Thiếu dữ liệu môi trường: mẫu nhiệt độ, độ ẩm hợp lệ dưới 80 % (Tầng 1 41,5 %)')
  })

  it('nguồn không xét, mưa, giai đoạn dẫn dụ, bình thường', () => {
    expect(formatHealthReason(reason('NOT_ASSESSED', {}, { source: 'air' }))).toBe('Chưa xét không khí (thiếu mẫu NH3, CO2)')
    expect(formatHealthReason(reason('NOT_ASSESSED', {}, { source: 'noise' }))).toBe('Chưa xét tiếng ồn (thiếu mẫu độ ồn)')
    expect(formatHealthReason(reason('RAIN_DOWNGRADE', { mm_per_hour: 1.5 }))).toBe(
      'Mưa từ 1,5 mm/giờ trùng phiên đếm và đợt ồn nên hạ từ Cần xử lý xuống Cần theo dõi',
    )
    expect(formatHealthReason(reason('ATTRACTING_STAGE'))).toBe('Đàn chim: nhà đang ở giai đoạn dẫn dụ, không xét tỷ lệ chim về')
    expect(formatHealthReason(reason('FLOCK_NO_BASELINE', { min_days: 3, baseline_days: 1 }))).toBe(
      'Đàn chim: chưa đủ 3 ngày để so sánh tỷ lệ chim về',
    )
    expect(formatHealthReason(reason('WEATHER_UNAVAILABLE'))).toBe('Không có dữ liệu thời tiết')
    expect(formatHealthReason(reason('ALL_NORMAL'))).toBe('Các chỉ số đã xét đều bình thường')
  })

  it('thiếu số liệu thì để trống, không in undefined', () => {
    expect(formatHealthReason(reason('NOISE_EPISODES', {}, { source: 'noise' }))).toBe('Tiếng ồn:  đợt ồn bất thường ()')
  })
})

describe('formatIndicatorValue', () => {
  it('đơn vị theo nguồn, thiếu thì "_"', () => {
    expect(formatIndicatorValue('environment', 92.4)).toBe('92,4 %')
    expect(formatIndicatorValue('air', 2)).toBe('2 giờ')
    expect(formatIndicatorValue('noise', 3)).toBe('3 đợt')
    expect(formatIndicatorValue('flock', null)).toBe('_')
  })
})

describe('ngày và hạn chấm', () => {
  it('cộng trừ ngày qua tháng', () => {
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01')
  })

  it('khoảng chờ chấm là 7 ngày trước tới hôm nay theo giờ Việt Nam', () => {
    // 20:00 UTC ngày 10/11 là 03:00 ngày 11/11 giờ Việt Nam
    expect(getPendingRatingRange(Date.parse('2026-11-10T20:00:00Z'))).toEqual({ from: '2026-11-04', to: '2026-11-11' })
  })

  it('ngày cuối còn chấm là ngay trước rating_deadline', () => {
    // Đầu ngày 09/11 giờ Việt Nam là 17:00 UTC ngày 08/11
    expect(formatLastRatingDay('2026-11-08T17:00:00.000Z')).toBe('08/11')
  })

  it('ngày chờ cũ nhất', () => {
    const days = [
      buildDay('house-a', '2026-11-09'),
      buildDay('house-b', '2026-11-05', { my_rating_state: 'RATED', current_status: 'GOOD' }),
      buildDay('house-b', '2026-11-07'),
    ]
    expect(getOldestPendingDay(days)?._id).toBe('house-b-2026-11-07')
    expect(getOldestPendingDay([])).toBeNull()
  })

  it('ngày chờ chấm bị che, ngày đã chấm thì không', () => {
    expect(isHealthDayHidden(buildDay('house-a', '2026-11-09'))).toBe(true)
    expect(isHealthDayHidden(buildDay('house-a', '2026-11-09', { my_rating_state: 'RATED', current_status: 'WATCH' }))).toBe(false)
    // Chuyên gia không phải người chấm: my_rating_state null, thấy đủ
    expect(isHealthDayHidden(buildDay('house-a', '2026-11-09', { my_rating_state: null, current_status: 'GOOD' }))).toBe(false)
  })
})
