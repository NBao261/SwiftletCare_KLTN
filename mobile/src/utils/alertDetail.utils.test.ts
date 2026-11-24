import { describe, expect, it } from '@jest/globals'
import type { Alert } from '@/types'
import { buildAlertTimeline, describeAlertDetail, getAutoCloseText } from '@/utils/alertDetail.utils'

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

describe('buildAlertTimeline', () => {
  const noMember = () => null

  it('xếp theo thời gian: tạo → nhắc lại → chuyên gia kết luận → chủ trại xác nhận', () => {
    const alert = buildAlert('a', {
      type: 'NOISE_ANOMALY',
      created_at: '2026-11-11T01:00:00.000Z',
      renotified_at: '2026-11-11T01:15:00.000Z',
      acknowledged_at: '2026-11-11T02:00:00.000Z',
      acknowledged_by: 'owner-1',
      acknowledgement_note: 'Đã kiểm tra',
      expert_verdict: {
        result: 'CONFIRMED',
        note: 'Kiểm tra lại van phun sương',
        by: { _id: 'expert-1', full_name: 'Chuyên gia A' },
        role: 'DOMAIN_EXPERT',
        at: '2026-11-11T01:30:00.000Z',
      },
      status: 'ACKNOWLEDGED',
    })
    const timeline = buildAlertTimeline(alert, userId => (userId === 'owner-1' ? 'Chủ trại B' : null))
    expect(timeline.map(entry => entry.key)).toEqual(['created', 'renotified', 'verdict', 'acknowledged'])
    expect(timeline[2]).toMatchObject({ actor: 'Chuyên gia A', action: 'Kết luận: cảnh báo đúng', note: 'Kiểm tra lại van phun sương' })
    expect(timeline[3]).toMatchObject({ actor: 'Chủ trại B', note: 'Đã kiểm tra' })
  })

  it('bị bác bỏ thì có dòng đóng ngay sau kết luận; farm chưa có chuyên gia thì người kết luận là chủ trại', () => {
    const alert = buildAlert('b', {
      type: 'NOISE_ANOMALY',
      status: 'DISMISSED',
      expert_verdict: { result: 'REJECTED', note: 'Báo nhầm', by: null, role: 'FARM_OWNER', at: '2026-11-11T03:00:00.000Z' },
    })
    const timeline = buildAlertTimeline(alert, noMember)
    expect(timeline.map(entry => entry.key)).toEqual(['created', 'verdict', 'dismissed'])
    expect(timeline[1].actor).toBe('Chủ trại')
  })

  it('tự đóng không qua xác nhận thì lý do hệ thống nằm ở dòng đóng', () => {
    const alert = buildAlert('c', {
      status: 'RESOLVED',
      resolved_at: '2026-11-11T04:00:00.000Z',
      acknowledgement_note: 'Số đo đã trở lại trong ngưỡng',
    })
    const timeline = buildAlertTimeline(alert, noMember)
    expect(timeline.map(entry => entry.key)).toEqual(['created', 'resolved'])
    expect(timeline[1]).toMatchObject({ actor: 'Hệ thống', note: 'Số đo đã trở lại trong ngưỡng' })
  })
})
