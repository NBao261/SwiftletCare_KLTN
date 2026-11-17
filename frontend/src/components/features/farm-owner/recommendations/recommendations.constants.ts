import type { BadgeTone } from '@/components/ui';
import type { Recommendation, RecommendationAction, RecommendationStatus } from '@/types';

// Màu nhãn trạng thái khuyến nghị
export const RECOMMENDATION_STATUS_TONE: Record<RecommendationStatus, BadgeTone> = {
  OPEN: 'warning',
  ACCEPTED: 'info',
  REJECTED: 'neutral',
  EXPIRED: 'neutral',
  MEASURED: 'positive',
};

// Luật lúc khuyến nghị mở (backend làm theo bản này khi chấp nhận); khuyến nghị cũ thì luật kèm ở danh sách; chỉ có id thì không hiện được
export function ruleOf(recommendation: Recommendation): { name: string; action: RecommendationAction } | null {
  if (recommendation.rule_snapshot) return recommendation.rule_snapshot;
  return typeof recommendation.rule_id === 'string' ? null : recommendation.rule_id;
}
