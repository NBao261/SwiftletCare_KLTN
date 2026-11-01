import { describe, expect, it } from '@jest/globals'
import type { Alert } from '@/types'
import { describeAlertDetail, getAutoCloseText } from '@/utils/alertDetail.utils'
import { countBySeverity, filterAlerts, getRenotifyState, isInferredAlert, sortAlerts } from '@/utils/alertList.utils'

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
      expert_verdict: { result: 'CONFIRMED', by: 'u', at: '2026-11-01T02:00:00.000Z' },
    }),
  ]

  it('lọc nhà gồm cảnh báo mức nhà và cảnh báo các tầng của nhà', () => {
    const result = filterAlerts(alerts, { ...noFilter, houseId: 'house-1', houseZoneIds: ['zone-1', 'zone-2'] })
    expect(result.map(alert => alert._id)).toEqual(['zone-1', 'zone-2', 'house', 'noise-confirmed'])
  })

  it('lọc tầng, mức, loại', () => {
    expect(filterAlerts(alerts, { ...noFilter, zoneId: 'zone-2' }).map(alert => alert._id)).toEqual(['zone-2'])
    expect(filterAlerts(alerts, { ...noFilter, severity: 'LOW' }).map(alert => alert._id)).toEqual(['house'])
    expect(filterAlerts(alerts, { ...noFilter, type: 'NOISE_ANOMALY' })).toHaveLength(1)
  })

  it('lọc phán quyết chỉ giữ loại suy luận', () => {
    expect(filterAlerts(alerts, { ...noFilter, verdict: 'pending' }).map(alert => alert._id)).toEqual(['house'])
    expect(filterAlerts(alerts, { ...noFilter, verdict: 'confirmed' }).map(alert => alert._id)).toEqual([
      'noise-confirmed',
    ])
  })
})

describe('countBySeverity và isInferredAlert', () => {
  it('đếm đủ 4 mức, mức không có là 0', () => {
    expect(countBySeverity([buildAlert('a'), buildAlert('b', { severity: 'CRITICAL' })])).toEqual({
      CRITICAL: 1,
      HIGH: 0,
      MEDIUM: 1,
      LOW: 0,
    })
  })

  it('4 loại suy luận như backend', () => {
    expect(isInferredAlert({ type: 'FORECAST_BREACH' })).toBe(true)
    expect(isInferredAlert({ type: 'THRESHOLD_BREACH' })).toBe(false)
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

describe('getAutoCloseText và describeAlertDetail', () => {
  it('điều kiện tự đóng theo code backend; loại không tự đóng thì đóng khi xử lý xong', () => {
    expect(getAutoCloseText('NODE_OFFLINE')).toBe('Tự đóng khi thiết bị kết nối lại')
    expect(getAutoCloseText('RS485_BUS_FAILURE')).toBe('Đóng khi sự cố được xử lý')
  })

  it('vượt ngưỡng NH3 ghi số đo, ngưỡng và câu không điều khiển quạt', () => {
    const lines = describeAlertDetail(
      buildAlert('a', { metadata: { breaches: [{ metric: 'nh3_ppm', value: 27, limit: 25, direction: 'above' }] } }),
    )
    expect(lines).toEqual(['NH3 27 ppm, vượt ngưỡng 25 ppm', 'NH3: giới hạn cảnh báo, không điều khiển quạt'])
  })

  it('tỉ lệ về tổ giảm và dự báo đọc đúng metadata; thiếu số thì không bịa dòng', () => {
    const rate = describeAlertDetail(
      buildAlert('b', {
        type: 'LOW_RETURN_RATE',
        metadata: { sessionDate: '2026-11-01', returnRate: 70, avg: 90, dropPct: 22.2, limit: 20 },
      }),
    )
    expect(rate).toHaveLength(2)
    expect(describeAlertDetail(buildAlert('c', { type: 'FORECAST_BREACH', metadata: {} }))).toEqual([])
  })
})
