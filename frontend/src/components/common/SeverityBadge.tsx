import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LEVEL_BADGE_CLASS, LEVEL_BADGE_MUTED_CLASS, LEVEL_BADGE_SIZE, SEVERITY_TO_LEVEL } from '@/constants/severity';
import { levelDict } from '@/constants/severity.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { AlertSeverity } from '@/types';

interface SeverityBadgeProps {
  severity: AlertSeverity;
  // Cảnh báo đã xử lý thì badge về xám
  isMuted?: boolean;
  className?: string;
}

// Badge mức độ cảnh báo, hiện theo 3 cấp chung
export default function SeverityBadge({ severity, isMuted = false, className }: SeverityBadgeProps): JSX.Element {
  const { t } = useTranslation(levelDict);
  const level = SEVERITY_TO_LEVEL[severity];
  const colorClass = isMuted ? LEVEL_BADGE_MUTED_CLASS : LEVEL_BADGE_CLASS[level];

  return <Badge className={cn(LEVEL_BADGE_SIZE, colorClass, className)}>{t(level)}</Badge>;
}
