import { describe, expect, it } from 'vitest'
import en from '@/i18n/en'
import enExpert from '@/i18n/en.expert'

describe('en.expert', () => {
  it('không trùng khoá với en.ts (en.ts thắng, bản dịch trùng không có tác dụng)', () => {
    expect(Object.keys(enExpert).filter(key => key in en)).toEqual([])
  })
})
