/**
 * ANALYTICS-FR-012, EXPERT-FR-013 — lý do trạng thái ngày lưu dạng mã; CSV in câu theo ngôn ngữ. Mỗi mã
 * phải có câu tiếng Việt và tiếng Anh, có số liệu của lý do và mức.
 */
import { HEALTH_REASON_CODES } from '@/models/houseHealthDay.model'
import { REASON_LANGS, formatReason } from '@/utils/healthReason.util'
import type { HealthReason } from '@/types'

const r = (code: HealthReason['code'], source: HealthReason['source'] = null, values = {}, level: HealthReason['level'] = null): HealthReason =>
  ({ code, source, level, values })

describe('formatReason', () => {
  it('mọi mã đều có câu không rỗng ở cả vi và en', () => {
    for (const lang of REASON_LANGS) {
      for (const code of HEALTH_REASON_CODES) {
        expect(formatReason(r(code, 'noise'), lang).length).toBeGreaterThan(0)
      }
    }
  })

  it('câu có số liệu và mức theo ngôn ngữ', () => {
    const drop = r('FLOCK_DROP', 'flock', { return_rate: 70, drop_pct: 30, baseline_avg: 100, baseline_days: 3 }, 'CLEAR')
    expect(formatReason(drop)).toBe('Đàn chim: tỷ lệ chim về 70 %, giảm 30 % so với trung bình 3 ngày trước (100 %) (mức rõ)')
    expect(formatReason(drop, 'en')).toBe('Flock: return rate 70 %, 30 % below the mean of the 3 previous days (100 %) (clear level)')
    expect(formatReason(r('AIR_OVER_LIMIT', 'air', { zone_name: 'Tầng 1', hours: 2 }, 'SLIGHT'), 'en'))
      .toBe('Air quality: NH3 or CO2 above the limit for 2 h in Tầng 1 (slight level)')
  })

  it('cùng mã khác nguồn: thiếu dữ liệu đàn chim / môi trường, chưa đánh giá không khí / tiếng ồn', () => {
    expect(formatReason(r('MISSING_DATA', 'flock', { missing: 'EVENING' }))).toBe('Thiếu dữ liệu đàn chim: thiếu phiên chiều')
    expect(formatReason(r('MISSING_DATA', 'environment', { no_zones: true }), 'en')).toBe('Missing environment data: the house has no zone')
    expect(formatReason(r('MISSING_DATA', 'environment', { min_pct: 80, zones: [{ zone_name: 'Tầng 1', valid_pct: 70 }] })))
      .toBe('Thiếu dữ liệu môi trường: mẫu nhiệt độ, độ ẩm hợp lệ dưới 80 % (Tầng 1 70 %)')
    expect(formatReason(r('NOT_ASSESSED', 'air'))).toBe('Chưa đánh giá không khí (thiếu mẫu NH3, CO2)')
    expect(formatReason(r('NOT_ASSESSED', 'noise'), 'en')).toBe('Noise not assessed (missing sound level samples)')
  })
})
