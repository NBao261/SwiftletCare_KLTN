import { describe, expect, it } from 'vitest'

import { detectionTuningPayload } from '@/components/features/domain-expert/tuning/tuning.utils'

describe('detectionTuningPayload (EXPERT-FR-008, todo-audit-1118 W-01)', () => {
  it('chỉ giữ 5 tham số của Zone, bỏ mức giảm tỷ lệ chim về (thuộc nhà) và khoá lạ', () => {
    const form = {
      noise_margin_db: 12, noise_min_sec: 10, pump_dry_on_sec: 300, pump_dry_min_rise_pct: 2, speaker_drop_pct: 70,
      return_rate_drop_pct: 30, unknown_key: 1,
    }
    expect(detectionTuningPayload(form)).toEqual({
      noise_margin_db: 12, noise_min_sec: 10, pump_dry_on_sec: 300, pump_dry_min_rise_pct: 2, speaker_drop_pct: 70,
    })
  })

  it('bỏ giá trị không phải số', () => {
    expect(detectionTuningPayload({ noise_margin_db: 12, noise_min_sec: undefined })).toEqual({ noise_margin_db: 12 })
  })
})
