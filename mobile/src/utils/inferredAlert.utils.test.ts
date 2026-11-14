import { describe, expect, it } from '@jest/globals'
import { getInferredAlertDescription, getInferredAlertLabel } from './inferredAlert.utils'

describe('inferredAlert.utils', () => {
  it('returns correct Vietnamese labels for known inferred alert types', () => {
    expect(getInferredAlertLabel('NOISE_ANOMALY')).toBe('Tiếng ồn bất thường trong nhà')
    expect(getInferredAlertLabel('SENSOR_ANOMALY')).toBe('Cảm biến nhảy số bất thường')
    expect(getInferredAlertLabel('FORECAST_BREACH')).toBe('Dự báo sắp lệch nhiệt ẩm')
    expect(getInferredAlertLabel('LOW_RETURN_RATE')).toBe('Đàn chim về tổ sụt giảm')
    expect(getInferredAlertLabel('MISTING_INEFFECTIVE')).toBe('Bơm sương chạy nhưng không lên ẩm')
  })

  it('returns fallback label for unknown alert type', () => {
    expect(getInferredAlertLabel('UNKNOWN_TYPE')).toBe('Cảnh báo bất thường')
  })

  it('returns correct description for known alert types', () => {
    expect(getInferredAlertDescription('NOISE_ANOMALY')).toContain('Tiếng ồn')
    expect(getInferredAlertDescription('UNKNOWN')).toBe('')
  })
})
