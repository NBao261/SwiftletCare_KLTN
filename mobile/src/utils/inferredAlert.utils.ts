import type { InferredAlertType } from '@/types'
import { t } from '@/utils/i18n.utils'

// MISTING_INEFFECTIVE là device alert, không thuộc inferred type cần kiểm chứng (api-spec.yaml dòng 3105)
const ALERT_TYPE_LABELS: Record<InferredAlertType, string> = {
  NOISE_ANOMALY: 'Tiếng ồn bất thường trong nhà',
  SENSOR_ANOMALY: 'Cảm biến nhảy số bất thường',
  FORECAST_BREACH: 'Dự báo sắp lệch nhiệt ẩm',
  LOW_RETURN_RATE: 'Đàn chim về tổ sụt giảm',
}

const ALERT_TYPE_DESCRIPTIONS: Record<InferredAlertType, string> = {
  NOISE_ANOMALY: 'Tiếng ồn trong nhà tăng cao hơn bình thường, nghi có chim hoảng loạn hoặc tiếng động lạ.',
  SENSOR_ANOMALY: 'Số liệu đo được nhảy vọt bất thường hoặc lệch hẳn so với các cảm biến cùng tầng.',
  FORECAST_BREACH: 'Xu hướng nhiệt ẩm 30-60 phút tới dự kiến sẽ vượt ra ngoài dải an toàn.',
  LOW_RETURN_RATE: 'Lượng chim yến bay về cửa thu thấp hơn đáng kể so với mọi ngày.',
}

/**
 * Lấy tên tiếng Việt thân thiện của loại cảnh báo bất thường
 */
export function getInferredAlertLabel(type: InferredAlertType | string): string {
  const key = type as InferredAlertType
  return ALERT_TYPE_LABELS[key] ? t(ALERT_TYPE_LABELS[key]) : t('Cảnh báo bất thường')
}

/**
 * Lấy giải thích nghiệp vụ tóm tắt của loại cảnh báo suy luận
 */
export function getInferredAlertDescription(type: InferredAlertType | string): string {
  const key = type as InferredAlertType
  return ALERT_TYPE_DESCRIPTIONS[key] ? t(ALERT_TYPE_DESCRIPTIONS[key]) : ''
}
