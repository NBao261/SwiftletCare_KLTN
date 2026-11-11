import { describe, expect, it } from '@jest/globals'
import type { Alert } from '@/types'
import { describeAlertDetail, getAutoCloseText } from '@/utils/alertDetail.utils'

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
