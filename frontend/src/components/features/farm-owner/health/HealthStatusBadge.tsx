import { Badge, type BadgeTone } from '@/components/ui';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { HealthStatus } from '@/types';

// Màu theo trạng thái ngày (BR-29): tốt xanh, theo dõi cam, xử lý đỏ, thiếu dữ liệu xám
const STATUS_TONE: Record<HealthStatus, BadgeTone> = {
  GOOD: 'positive',
  WATCH: 'warning',
  ACTION: 'critical',
  INSUFFICIENT_DATA: 'neutral',
};

export default function HealthStatusBadge({ status }: { status: HealthStatus }): JSX.Element {
  const { t } = useTranslation(healthDict);
  return <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>;
}
