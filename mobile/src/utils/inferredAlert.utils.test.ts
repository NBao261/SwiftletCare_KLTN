import { describe, expect, it } from '@jest/globals'
import { getInferredAlertDescription, getInferredAlertLabel } from './inferredAlert.utils'

describe('inferredAlert.utils', () => {
  it('returns correct Vietnamese labels for known inferred alert types', () => {
    expect(getInferredAlertLabel('NOISE_ANOMALY')).toBe('Dị thường âm thanh')
    expect(getInferredAlertLabel('SENSOR_ANOMALY')).toBe('Cảm biến sai lệch')
    expect(getInferredAlertLabel('FORECAST_BREACH')).toBe('Dự báo vi phạm vi khí hậu')
    expect(getInferredAlertLabel('LOW_RETURN_RATE')).toBe('Tỷ lệ chim về thấp')
    expect(getInferredAlertLabel('MISTING_INEFFECTIVE')).toBe('Bơm sương không hiệu quả')
  })

  it('returns fallback label for unknown alert type', () => {
    expect(getInferredAlertLabel('UNKNOWN_TYPE')).toBe('Cảnh báo suy luận AI')
  })

  it('returns correct description for known alert types', () => {
    expect(getInferredAlertDescription('NOISE_ANOMALY')).toContain('baseline')
    expect(getInferredAlertDescription('UNKNOWN')).toBe('')
  })
})
