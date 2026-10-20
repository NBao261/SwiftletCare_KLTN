import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LEVEL_BADGE_CLASS, LEVEL_BADGE_MUTED_CLASS, LEVEL_BADGE_SIZE } from '@/constants/severity';
import { levelDict } from '@/constants/severity.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { TicketPriority } from '@/types';

interface PriorityBadgeProps {
  priority: TicketPriority;
  display?: 'label' | 'code' | 'full';
  count?: number;
  isMuted?: boolean;
  className?: string;
}

// Badge 3 cấp mức độ, dùng cho ưu tiên ticket và mức cảnh báo
export default function PriorityBadge({
  priority,
  display = 'label',
  count,
  isMuted = false,
  className,
}: PriorityBadgeProps): JSX.Element {
  const { t } = useTranslation(levelDict);
  const label = t(priority);
  let text = label;
  if (display === 'code') text = priority;
  if (display === 'full') text = `${priority} · ${label}`;
  if (count !== undefined) text = `${text} · ${count}`;
  const colorClass = isMuted ? LEVEL_BADGE_MUTED_CLASS : LEVEL_BADGE_CLASS[priority];

  return (
    <Badge className={cn(LEVEL_BADGE_SIZE, colorClass, className)}>{text}</Badge>
  );
}
