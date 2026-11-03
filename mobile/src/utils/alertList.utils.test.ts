import { describe, expect, it } from '@jest/globals'
import type { Alert } from '@/types'
import {
  countBySeverityLevel,
  filterAlerts,
  getRenotifyState,
  isInferredAlert,
  sortAlerts,
  uniqueById,
} from '@/utils/alertList.utils'

// Cảnh báo tối thiểu cho test
function buildAlert(id: string, overrides: Partial<Alert> = {}): Alert {
  return {
    _id: id,
    farm_id: 'farm-1',
    zone_id: 'zone-1',
    type: 'THRESHOLD_BREACH',
    severity: 'MEDIUM',
    title: 'x',
    message: 'x',
    status: 'ACTIVE',
    created_at: '2026-11-01T01:00:00.000Z',
    ...overrides,
  }
}

const noFilter = { houseId: null, houseZoneIds: [], zoneId: null, severity: null, type: null, verdict: null }

describe('sortAlerts', () => {
  it('mức nặng trước, chưa xác nhận trước đã xác nhận, rồi mới nhất trước', () => {
    const sorted = sortAlerts([
      buildAlert('low', { severity: 'LOW' }),
      buildAlert('medium-ack', { status: 'ACKNOWLEDGED', created_at: '2026-11-01T03:00:00.000Z' }),
      buildAlert('medium-old'),
      buildAlert('medium-new', { last_seen_at: '2026-11-01T02:00:00.000Z' }),
      buildAlert('critical', { severity: 'CRITICAL' }),
    ])
    expect(sorted.map(alert => alert._id)).toEqual(['critical', 'medium-new', 'medium-old', 'medium-ack', 'low'])
  })
})

describe('filterAlerts', () => {
  const alerts = [
    buildAlert('zone-1'),
    buildAlert('zone-2', { zone_id: 'zone-2', severity: 'HIGH' }),
    buildAlert('house', { zone_id: undefined, house_id: 'house-1', type: 'LOW_RETURN_RATE', severity: 'LOW' }),
    buildAlert('other-house', { zone_id: 'zone-9' }),
    buildAlert('noise-confirmed', {
      type: 'NOISE_ANOMALY',
      expert_verdict: { result: 'CONFIRMED', by: { _id: 'u', full_name: 'Chuyên gia A' }, at: '2026-11-01T02:00:00.000Z' },
    }),
  ]

  it('lọc nhà gồm cảnh báo mức nhà và cảnh báo các tầng của nhà', () => {
    const result = filterAlerts(alerts, { ...noFilter, houseId: 'house-1', houseZoneIds: ['zone-1', 'zone-2'] })
    expect(result.map(alert => alert._id)).toEqual(['zone-1', 'zone-2', 'house', 'noise-confirmed'])
  })

  it('lọc tầng, mức, loại', () => {
    expect(filterAlerts(alerts, { ...noFilter, zoneId: 'zone-2' }).map(alert => alert._id)).toEqual(['zone-2'])
    expect(filterAlerts(alerts, { ...noFilter, severity: 'P3' }).map(alert => alert._id)).toEqual(['house'])
    expect(filterAlerts(alerts, { ...noFilter, type: 'NOISE_ANOMALY' })).toHaveLength(1)
  })

  it('lọc phán quyết chỉ giữ loại suy luận', () => {
    expect(filterAlerts(alerts, { ...noFilter, verdict: 'pending' }).map(alert => alert._id)).toEqual(['house'])
    expect(filterAlerts(alerts, { ...noFilter, verdict: 'confirmed' }).map(alert => alert._id)).toEqual([
      'noise-confirmed',
    ])
  })
})

describe('countBySeverityLevel và isInferredAlert', () => {
  it('đếm đủ 3 cấp, CRITICAL và HIGH cùng là Khẩn cấp, cấp không có là 0', () => {
    expect(
      countBySeverityLevel([buildAlert('a'), buildAlert('b', { severity: 'CRITICAL' }), buildAlert('c', { severity: 'HIGH' })]),
    ).toEqual({ P1: 2, P2: 1, P3: 0 })
  })

  it('4 loại suy luận như backend', () => {
    expect(isInferredAlert({ type: 'FORECAST_BREACH' })).toBe(true)
    expect(isInferredAlert({ type: 'THRESHOLD_BREACH' })).toBe(false)
  })
})

describe('uniqueById', () => {
  it('ghép nhiều trang: cảnh báo trùng id chỉ giữ một lần, đúng thứ tự gặp đầu tiên', () => {
    const merged = uniqueById([buildAlert('a'), buildAlert('b'), buildAlert('a', { status: 'ACKNOWLEDGED' }), buildAlert('c')])
    expect(merged.map(alert => alert._id)).toEqual(['a', 'b', 'c'])
    expect(merged[0]?.status).toBe('ACTIVE')
  })
})

describe('getRenotifyState', () => {
  const created = Date.parse('2026-11-01T01:00:00.000Z')

  it('CRITICAL/HIGH nhắc lại sau 15 phút, NODE_OFFLINE sau 1 giờ', () => {
    expect(getRenotifyState(buildAlert('a', { severity: 'HIGH' }), created + 5 * 60 * 1000)).toEqual({
      kind: 'countdown',
      minutes: 10,
    })
    expect(
      getRenotifyState(buildAlert('b', { type: 'NODE_OFFLINE', severity: 'HIGH' }), created + 5 * 60 * 1000),
    ).toEqual({ kind: 'countdown', minutes: 55 })
  })

  it('đã nhắc thì báo đã nhắc; mức khác, đã xác nhận thì không nhắc', () => {
    expect(getRenotifyState(buildAlert('a', { severity: 'CRITICAL', renotified_at: 'x' }), created)).toEqual({
      kind: 'sent',
    })
    expect(getRenotifyState(buildAlert('b'), created)).toBeNull()
    expect(getRenotifyState(buildAlert('c', { severity: 'HIGH', status: 'ACKNOWLEDGED' }), created)).toBeNull()
  })
})
