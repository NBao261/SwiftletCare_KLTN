import Stepper from '@/components/ui/Stepper';
import { ticketStatusDict } from '@/constants/enumLabels.i18n';
import { buildTicketProgressSteps, findStepIndex, type ExtraProgressStep } from '@/constants/ticketStatus';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { TicketStatus } from '@/types';

interface TicketProgressStepperProps {
  status: TicketStatus;
  extraSteps?: ExtraProgressStep[];
  currentKey?: string;
  className?: string;
}

// Thanh tiến độ ticket dùng chung: 4 bước trạng thái, bước đang làm nền đậm, đoạn nối tới bước sau có hiệu ứng chạy
export default function TicketProgressStepper({
  status,
  extraSteps = [],
  currentKey,
  className,
}: TicketProgressStepperProps): JSX.Element {
  const { lang } = useTranslation(ticketStatusDict);
  const steps = buildTicketProgressSteps(ticketStatusDict[lang], extraSteps);
  const current = findStepIndex(steps, currentKey ?? status);

  return (
    <Stepper
      steps={steps.map(step => step.label)}
      current={current}
      completed={status === 'CLOSED'}
      activeTone="strong"
      showNextProgress
      className={className}
    />
  );
}
