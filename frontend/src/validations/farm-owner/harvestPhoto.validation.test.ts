import { describe, expect, it } from 'vitest'
import { HARVEST_PHOTO_MAX_BYTES, validateHarvestPhoto } from '@/validations/farm-owner/harvestPhoto.validation'

// HARVEST-FR-001 — ảnh của lần thu
describe('validateHarvestPhoto', () => {
  it('nhận JPEG, PNG, WebP tới 5 MB', () => {
    expect(validateHarvestPhoto({ type: 'image/jpeg', size: 1000 })).toBeNull()
    expect(validateHarvestPhoto({ type: 'image/webp', size: HARVEST_PHOTO_MAX_BYTES })).toBeNull()
  })

  it('từ chối định dạng khác và ảnh quá 5 MB', () => {
    expect(validateHarvestPhoto({ type: 'image/gif', size: 1000 })).toBe('type')
    expect(validateHarvestPhoto({ type: 'image/png', size: HARVEST_PHOTO_MAX_BYTES + 1 })).toBe('size')
  })
})
