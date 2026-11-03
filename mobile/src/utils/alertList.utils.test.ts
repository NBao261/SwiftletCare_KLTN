import { describe, expect, it } from '@jest/globals'
import type { Alert } from '@/types'
import {
  ACTIVE_ALERT_STATUSES,
  buildAlertChain,
  countBySeverityLevel,
  filterAlerts,
  getNextAlertChainPage,
  getRenotifyState,
  isInferredAlert,
  sortAlerts,
  sumLevelCounts,
  toAlertQueryParams,
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

describe('chuỗi trang phân trang ở server', () => {
  it('chưa xác nhận trước đã xác nhận; lọc Khẩn cấp thì CRITICAL rồi HIGH trong từng trạng thái', () => {
    expect(buildAlertChain(ACTIVE_ALERT_STATUSES, null)).toEqual([
      { status: 'ACTIVE', severity: null },
      { status: 'ACKNOWLEDGED', severity: null },
    ])
    expect(buildAlertChain(['ACTIVE'], 'P1')).toEqual([
      { status: 'ACTIVE', severity: 'CRITICAL' },
      { status: 'ACTIVE', severity: 'HIGH' },
    ])
  })

  it('tham số chỉ gửi bộ lọc đang dùng; mọi farm thì không gửi farmId', () => {
    const params = toAlertQueryParams(
      { farmId: null, zoneId: null, type: 'NOISE_ANOMALY', verdict: 'pending' },
      { status: 'RESOLVED', severity: 'LOW' },
      2,
      20,
    )
    expect(params).toEqual({ type: 'NOISE_ANOMALY', verdict: 'pending', status: 'RESOLVED', severity: 'LOW', page: '2', limit: '20' })
  })

  it('trang kế: mắt còn thì trang sau, hết thì sang mắt sau, hết chuỗi thì dừng', () => {
    const alerts = (count: number) => Array.from({ length: count }, (_, index) => buildAlert(`a${index}`))
    expect(getNextAlertChainPage(2, [])).toEqual({ link: 0, page: 1 })
    expect(getNextAlertChainPage(2, [{ link: 0, items: alerts(20), total: 25 }])).toEqual({ link: 0, page: 2 })
    expect(
      getNextAlertChainPage(2, [
        { link: 0, items: alerts(20), total: 25 },
        { link: 0, items: alerts(5), total: 25 },
      ]),
    ).toEqual({ link: 1, page: 1 })
    expect(getNextAlertChainPage(2, [{ link: 1, items: [], total: 0 }])).toBeUndefined()
  })

  it('cộng số theo cấp: CRITICAL và HIGH cùng Khẩn cấp', () => {
    expect(sumLevelCounts({ CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 })).toEqual({ P1: 3, P2: 3, P3: 4 })
  })
})
