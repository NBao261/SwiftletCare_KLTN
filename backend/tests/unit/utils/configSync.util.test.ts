import { CONFIG_MISMATCH_HEARTBEATS, currentConfigVersion, syncAfterHeartbeat } from '@/utils/configSync.util'

describe('syncAfterHeartbeat (Report 3 §6.12)', () => {
  it('đúng phiên bản của Zone thì APPLIED và đếm lại từ 0', () => {
    expect(syncAfterHeartbeat({ stale: 2 }, 100, 100)).toEqual({ state: 'APPLIED', applied: 100, stale: 0 })
  })

  it('phiên bản cũ: PENDING, tới heartbeat thứ 3 thì MISMATCH (BR-24)', () => {
    expect(syncAfterHeartbeat({ stale: 0 }, 99, 100)).toEqual({ state: 'PENDING', applied: 99, stale: 1 })
    expect(syncAfterHeartbeat({ stale: CONFIG_MISMATCH_HEARTBEATS - 2 }, 99, 100).state).toBe('PENDING')
    expect(syncAfterHeartbeat({ stale: CONFIG_MISMATCH_HEARTBEATS - 1 }, 99, 100).state).toBe('MISMATCH')
  })

  it.each([undefined, null, '100', 1.5, -1])('heartbeat không có phiên bản hợp lệ (%p) thì UNKNOWN', reported => {
    expect(syncAfterHeartbeat({ stale: 5 }, reported, 100)).toEqual({ state: 'UNKNOWN', applied: null, stale: 0 })
  })

  it('phiên bản là giây Unix', () => {
    expect(currentConfigVersion(Date.UTC(2026, 10, 12, 0, 0, 1, 999))).toBe(Date.UTC(2026, 10, 12, 0, 0, 1) / 1000)
  })
})
