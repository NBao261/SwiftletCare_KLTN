import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ticketDisplayStatusDict } from '@/constants/enumLabels.i18n';
import { TICKET_STATUS_BADGE_CLASS, TICKET_STATUS_BADGE_SIZE, ticketDisplayStatus } from '@/constants/ticketStatus';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { TicketStatus } from '@/types';

interface TicketStatusBadgeProps {
  ticket: { status: TicketStatus; cancelled_at?: string };
  className?: string;
}

// Badge trạng thái ticket dùng chung: nhãn VI/EN + màu theo constants/ticketStatus.ts
export default function TicketStatusBadge({ ticket, className }: TicketStatusBadgeProps): JSX.Element {
  const { t } = useTranslation(ticketDisplayStatusDict);
  const status = ticketDisplayStatus(ticket);

  return (
    <Badge className={cn(TICKET_STATUS_BADGE_SIZE, TICKET_STATUS_BADGE_CLASS[status], className)}>
      {t(status)}
    </Badge>
  );
}
