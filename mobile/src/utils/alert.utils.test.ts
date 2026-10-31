import { describe, expect, it } from '@jest/globals'
import type { Alert } from '@/types'
import { getAlertHeadline, pickMostUrgentAlert } from '@/utils/alert.utils'

// Cảnh báo đang mở tối thiểu cho test
function buildAlert(id: string, severity: Alert['severity'], createdAt: string): Alert {
  return {
    _id: id,
    farm_id: 'farm-1',
    type: 'THRESHOLD_BREACH',
    severity,
    title: `Cảnh báo ${id}`,
    message: '',
    status: 'ACTIVE',
    created_at: createdAt,
  }
}

describe('pickMostUrgentAlert', () => {
  it('chọn mức độ cao nhất dù cũ hơn', () => {
    const alerts = [
      buildAlert('medium', 'MEDIUM', '2026-10-30T10:00:00.000Z'),
      buildAlert('critical', 'CRITICAL', '2026-10-30T08:00:00.000Z'),
    ]
    expect(pickMostUrgentAlert(alerts)?._id).toBe('critical')
  })

  it('cùng mức độ thì chọn cảnh báo mới nhất', () => {
    const alerts = [
      buildAlert('older', 'HIGH', '2026-10-30T08:00:00.000Z'),
      buildAlert('newer', 'HIGH', '2026-10-30T09:00:00.000Z'),
    ]
    expect(pickMostUrgentAlert(alerts)?._id).toBe('newer')
  })

  it('không có cảnh báo thì null', () => {
    expect(pickMostUrgentAlert([])).toBeNull()
  })
})

describe('getAlertHeadline', () => {
  const breachAlert = (breaches: unknown[]): Alert => ({
    ...buildAlert('breach', 'HIGH', '2026-10-30T10:00:00.000Z'),
    title: 'Vượt ngưỡng tại Tầng 1',
    metadata: { breaches },
  })

  it('ghép tên chỉ số, nơi xảy ra, giá trị và ngưỡng', () => {
    const alert = breachAlert([{ metric: 'temperature', value: 36.2, limit: 35, direction: 'above' }])
    expect(getAlertHeadline(alert, 'Tầng 1')).toBe('Nhiệt độ Tầng 1: 36.2°C (Vượt ngưỡng 35°C)')
  })

  it('dưới ngưỡng và nhiều chỉ số thì ghi số chỉ số còn lại', () => {
    const alert = breachAlert([
      { metric: 'humidity', value: 60, limit: 75, direction: 'below' },
      { metric: 'co2_ppm', value: 1600, limit: 1500, direction: 'above' },
    ])
    expect(getAlertHeadline(alert)).toBe('Độ ẩm: 60% (Dưới ngưỡng 75%) +1 chỉ số')
  })

  it('không có số liệu ngưỡng thì dùng tiêu đề', () => {
    expect(getAlertHeadline(breachAlert([]))).toBe('Vượt ngưỡng tại Tầng 1')
  })
})
