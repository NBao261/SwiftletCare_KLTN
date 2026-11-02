import type { InferredAlertType } from '@/types'
import { t } from '@/utils/i18n.utils'

const ALERT_TYPE_LABELS: Record<InferredAlertType, string> = {
  NOISE_ANOMALY: 'Dị thường âm thanh',
  SENSOR_ANOMALY: 'Cảm biến sai lệch',
  FORECAST_BREACH: 'Dự báo vi phạm vi khí hậu',
  LOW_RETURN_RATE: 'Tỷ lệ chim về thấp',
  MISTING_INEFFECTIVE: 'Bơm sương không hiệu quả',
}

const ALERT_TYPE_DESCRIPTIONS: Record<InferredAlertType, string> = {
  NOISE_ANOMALY: 'Cường độ âm thanh đo được vượt ngưỡng so với baseline môi trường âm học.',
  SENSOR_ANOMALY: 'Số liệu cảm biến có bước nhảy bất thường hoặc không đồng bộ với các cảm biến cùng tầng.',
  FORECAST_BREACH: 'Dự báo môi trường trong 30-60 phút tới có nguy cơ vượt ngưỡng an toàn vi khí hậu.',
  LOW_RETURN_RATE: 'Số lượng cá thể chim quay về tổ giảm đột ngột so với trung bình chu kỳ.',
  MISTING_INEFFECTIVE: 'Hệ thống phun sương đã kích hoạt nhưng độ ẩm không đạt mức tăng tiêu chuẩn.',
}

/**
 * Lấy tên tiếng Việt thân thiện của loại cảnh báo suy luận AI (EXPERT-FR-003)
 */
export function getInferredAlertLabel(type: InferredAlertType | string): string {
  const key = type as InferredAlertType
  return ALERT_TYPE_LABELS[key] ? t(ALERT_TYPE_LABELS[key]) : t('Cảnh báo suy luận AI')
}

/**
 * Lấy giải thích nghiệp vụ tóm tắt của loại cảnh báo suy luận
 */
export function getInferredAlertDescription(type: InferredAlertType | string): string {
  const key = type as InferredAlertType
  return ALERT_TYPE_DESCRIPTIONS[key] ? t(ALERT_TYPE_DESCRIPTIONS[key]) : ''
}
