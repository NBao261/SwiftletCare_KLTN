import { describe, expect, it } from 'vitest'

import { hoursLeftToRestore } from '@/components/features/farm-owner/devices/removedDevices'

describe('hoursLeftToRestore (FARM-FR-008, todo-audit-1118 W-08)', () => {
  const now = Date.parse('2026-11-19T10:00:00Z')

  it('làm tròn lên số giờ còn lại', () => {
    expect(hoursLeftToRestore('2026-11-20T09:00:00Z', now)).toBe(23)
    expect(hoursLeftToRestore('2026-11-19T10:30:00Z', now)).toBe(1)
  })

  it('đã hết hạn thì 0', () => {
    expect(hoursLeftToRestore('2026-11-19T09:59:00Z', now)).toBe(0)
  })
})
