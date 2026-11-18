import { describe, expect, it } from 'vitest'
import { validateThresholdSource } from '@/validations/common/threshold.validation'

// ENV-FR-007 — nguồn của ngưỡng mặc định, cùng luật với route PUT /system/settings/default-thresholds
describe('validateThresholdSource', () => {
  it('nhận nguồn có mã mục REF-5', () => {
    expect(validateThresholdSource('TL-003 sách nuôi yến')).toBeUndefined()
    expect(validateThresholdSource('  MC-012 ')).toBeUndefined()
  })

  it('từ chối nguồn trống, thiếu mã REF-5 hoặc quá dài', () => {
    expect(validateThresholdSource('   ')).toBe('Cần ghi nguồn của ngưỡng')
    expect(validateThresholdSource('sách nuôi yến')).toMatch(/REF-5/)
    expect(validateThresholdSource('KD-12')).toMatch(/REF-5/)
    expect(validateThresholdSource('XTL-0034')).toMatch(/REF-5/)
    expect(validateThresholdSource(`TL-001 ${'x'.repeat(500)}`)).toMatch(/500/)
  })
})
