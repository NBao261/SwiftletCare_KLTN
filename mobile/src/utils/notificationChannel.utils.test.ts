import { describe, expect, it } from '@jest/globals'
import type { NotificationPreferences } from '@/types'
import {
  applyGeneralPush,
  buildBySeverityPayload,
  getLevelChannels,
  urgentHasOutsideChannel,
} from '@/utils/notificationChannel.utils'

// Cài đặt mẫu: push chung bật, Telegram chung tắt, mức Thường tắt push
const PREFERENCES: NotificationPreferences = {
  push: true,
  telegram: false,
  quiet_hours: { start: '22:00', end: '06:00' },
  by_severity: { LOW: { push: false, telegram: false } },
}

describe('getLevelChannels', () => {
  it('cấp không ghi đè thì theo kênh chung, cấp có ghi đè thì theo ghi đè', () => {
    const levels = getLevelChannels(PREFERENCES)
    expect(levels.P1).toEqual({ push: true, telegram: false })
    expect(levels.P2).toEqual({ push: true, telegram: false })
    expect(levels.P3).toEqual({ push: false, telegram: false })
  })

  it('chưa có cài đặt thì push và Telegram đều bật như mặc định backend', () => {
    expect(getLevelChannels(undefined).P1).toEqual({ push: true, telegram: true })
  })
})

describe('buildBySeverityPayload', () => {
  it('mức giống kênh chung gửi null, mức khác gửi ghi đè; Khẩn cấp gồm CRITICAL và HIGH', () => {
    const levels = getLevelChannels(PREFERENCES)
    levels.P1 = { push: true, telegram: true }
    const payload = buildBySeverityPayload(levels, { push: true, telegram: false })
    expect(payload.CRITICAL).toEqual({ push: true, telegram: true })
    expect(payload.HIGH).toEqual({ push: true, telegram: true })
    expect(payload.MEDIUM).toBeNull()
    expect(payload.LOW).toEqual({ push: false, telegram: false })
  })
})

describe('applyGeneralPush / urgentHasOutsideChannel', () => {
  it('đổi push chung thì mọi cấp đổi theo', () => {
    const levels = applyGeneralPush(getLevelChannels(PREFERENCES), false)
    expect(levels.P1.push).toBe(false)
    expect(levels.P3.push).toBe(false)
  })

  it('Khẩn cấp cần push, hoặc Telegram đã liên kết', () => {
    expect(urgentHasOutsideChannel({ push: false, telegram: true }, true)).toBe(true)
    expect(urgentHasOutsideChannel({ push: false, telegram: true }, false)).toBe(false)
    expect(urgentHasOutsideChannel({ push: true, telegram: false }, false)).toBe(true)
  })
})
