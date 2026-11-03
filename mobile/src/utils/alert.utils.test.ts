import { describe, expect, it } from '@jest/globals'
import type { Alert } from '@/types'
import {
  getAlertHeadline,
  getForecastMinutesAhead,
  getHighestSeverity,
  getPumpOnBlockingAlerts,
  pickMostUrgentAlert,
} from '@/utils/alert.utils'

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

describe('getHighestSeverity', () => {
  it('lấy mức cao nhất, rỗng thì null', () => {
    const alerts = [buildAlert('a', 'LOW', '2026-10-30T01:00:00.000Z'), buildAlert('b', 'HIGH', '2026-10-29T01:00:00.000Z')]
    expect(getHighestSeverity(alerts)).toBe('HIGH')
    expect(getHighestSeverity([])).toBeNull()
  })
})

describe('getForecastMinutesAhead', () => {
  it('lấy mốc sớm nhất của đúng chỉ số, bỏ metadata sai dạng', () => {
    const forecast = (minutesAhead: unknown, metric: string): Alert => ({
      ...buildAlert(`f-${String(minutesAhead)}`, 'LOW', '2026-10-30T01:00:00.000Z'),
      type: 'FORECAST_BREACH',
      metadata: { predicted: { metric, minutesAhead } },
    })
    const alerts = [forecast(40, 'humidity'), forecast(25, 'humidity'), forecast(10, 'temperature'), forecast('x', 'humidity')]
    expect(getForecastMinutesAhead(alerts, 'humidity')).toBe(25)
    expect(getForecastMinutesAhead(alerts, 'temperature')).toBe(10)
    expect(getForecastMinutesAhead([buildAlert('a', 'LOW', '2026-10-30T01:00:00.000Z')], 'humidity')).toBeNull()
  })
})

describe('getPumpOnBlockingAlerts', () => {
  it('chỉ lấy cảnh báo cảm biến hỏng và phun sương không hiệu quả (ENV-FR-016)', () => {
    const sensorFault: Alert = { ...buildAlert('s', 'MEDIUM', '2026-10-30T01:00:00.000Z'), type: 'SENSOR_FAULT' }
    const breach = buildAlert('t', 'HIGH', '2026-10-30T01:00:00.000Z')
    expect(getPumpOnBlockingAlerts([sensorFault, breach]).map(alert => alert._id)).toEqual(['s'])
  })
})
