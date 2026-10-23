import PriorityBadge from '@/components/common/PriorityBadge';
import { SEVERITY_TO_LEVEL } from '@/constants/severity';
import type { AlertSeverity } from '@/types';

interface SeverityBadgeProps {
  severity: AlertSeverity;
  // Cảnh báo đã xử lý thì badge về xám, cùng quy tắc ticket đã đóng/huỷ
  isMuted?: boolean;
  className?: string;
}

// Badge mức độ cảnh báo, hiện theo 3 cấp chung
export default function SeverityBadge({ severity, isMuted = false, className }: SeverityBadgeProps): JSX.Element {
  return <PriorityBadge priority={SEVERITY_TO_LEVEL[severity]} isMuted={isMuted} className={className} />;
}
