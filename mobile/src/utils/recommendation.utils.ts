import type { Recommendation, RecommendationAction, RecommendationComparison } from '@/types'
import { t } from '@/utils/i18n.utils'
import { getFuzzyTuningLabel, getRecommendationIndicatorLabel, getThresholdKeyLabel } from '@/utils/label.utils'
import { formatStoredNumber } from '@/utils/settingsValidation.utils'

const COMPARISON_SIGNS: Record<RecommendationComparison, string> = { GTE: '≥', LTE: '≤' }

// Tên luật: bản chụp lúc mở, khuyến nghị cũ thì lấy từ luật backend kèm ở danh sách
export function getRecommendationRuleName(recommendation: Recommendation): string {
  if (recommendation.rule_snapshot) return recommendation.rule_snapshot.name
  return typeof recommendation.rule_id === 'string' ? '_' : recommendation.rule_id.name
}

// Hành động của khuyến nghị (theo bản chụp của luật lúc mở); không đọc được thì null
export function getRecommendationAction(recommendation: Recommendation): RecommendationAction | null {
  if (recommendation.rule_snapshot) return recommendation.rule_snapshot.action
  return typeof recommendation.rule_id === 'string' ? null : recommendation.rule_id.action
}

// Giá trị kèm đơn vị, bỏ số 0 thừa: "80 %", "1,5 giờ"; đơn vị trống thì chỉ có số
function formatWithUnit(value: number, unit: string): string {
  const trimmed = unit.trim()
  return trimmed ? `${formatStoredNumber(value)} ${trimmed}` : formatStoredNumber(value)
}

// Câu mô tả việc sẽ xảy ra khi chấp nhận: mở phiếu có tiêu đề, hoặc đổi một ngưỡng / hệ số cho mọi khu vực của nhà
export function describeRecommendationAction(action: RecommendationAction | null): string {
  if (!action) return '_'
  if (action.type === 'WORK_ORDER') return t('Mở phiếu công việc: {title}', { title: action.title })
  const { label, unit } = action.group === 'thresholds' ? getThresholdKeyLabel(action.key) : getFuzzyTuningLabel(action.key)
  return t('Đổi {parameter} thành {value} cho mọi khu vực của nhà', {
    parameter: label.toLowerCase(),
    value: formatWithUnit(action.value, unit),
  })
}

// Điều kiện của luật: "Thời gian trong ngưỡng ≤ 75 % trong 3 ngày liền"
export function describeRecommendationCondition(recommendation: Recommendation): string {
  const { indicator, comparison, value, window_days: windowDays } = recommendation.evidence
  const { label, unit } = getRecommendationIndicatorLabel(indicator)
  return t('{indicator} {sign} {value} trong {days} ngày liền', {
    indicator: label,
    sign: COMPARISON_SIGNS[comparison],
    value: formatWithUnit(value, unit),
    days: windowDays,
  })
}

// Giá trị một ngày của bằng chứng kèm đơn vị; thiếu số thì "_"
export function formatEvidenceValue(recommendation: Recommendation, value: number | null): string {
  if (value === null) return '_'
  return formatWithUnit(value, getRecommendationIndicatorLabel(recommendation.evidence.indicator).unit)
}
