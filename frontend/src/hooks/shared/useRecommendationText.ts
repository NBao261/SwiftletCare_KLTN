import { recommendationsDict } from '@/constants/recommendations.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { RecommendationAction, RecommendationComparison, RecommendationIndicator } from '@/types';

// Câu điều kiện và câu đề xuất của luật khuyến nghị
export function useRecommendationText() {
  const { t, exact } = useTranslation(recommendationsDict);
  const condition = (rule: { indicator: RecommendationIndicator; comparison: RecommendationComparison; value: number; window_days: number }) =>
    t('condition', {
      indicator: t(`indicator.${rule.indicator}`),
      comparison: t(`comparison.${rule.comparison}`),
      value: exact(rule.value, 2),
      days: rule.window_days,
    });
  const action = (value: RecommendationAction) => {
    if (value.type === 'WORK_ORDER') return t('action.WORK_ORDER', { title: value.title });
    return t('action.PARAMETER_CHANGE', { param: t(`param.${value.key}`), value: exact(value.value, 2) });
  };
  return { condition, action };
}
