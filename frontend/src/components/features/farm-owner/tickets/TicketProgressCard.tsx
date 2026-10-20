import { XCircleIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui'
import TicketProgressStepper from '@/components/common/TicketProgressStepper'
import { useTranslation } from '@/hooks/common/useTranslation'
import { supportDict } from '@/constants/support.i18n'
import { progressHintKey } from '@/components/features/farm-owner/tickets/tickets.constants'
import type { Ticket } from '@/types'

// Tiến độ ticket cho chủ nhà yến: Mới → Đã tiếp nhận → Đang xử lý → Hoàn tất (nghiệm thu SAT là việc của kỹ thuật viên, không hiện ở đây)
export default function TicketProgressCard({ ticket }: { ticket: Ticket }) {
  const { t, dateTime } = useTranslation(supportDict)
  const cancelled = !!ticket.cancelled_at

  return (
    <Card size="lg" className="flex flex-col gap-5">
      <div>
        <h2 className="text-h2 text-charcoal">{t('progress.title')}</h2>
        <p className="mt-1 text-sm text-warmGray">
          {cancelled ? t('progress.cancelledAt', { time: dateTime(ticket.cancelled_at!) }) : t(progressHintKey(ticket))}
        </p>
      </div>

      {cancelled ? (
        <div className="flex items-center gap-3 rounded-xl bg-warmGray/10 px-4 py-3">
          <XCircleIcon size={20} className="shrink-0 text-graphite" />
          <p className="text-sm text-graphite">{t('progress.cancelledNote')}</p>
        </div>
      ) : (
        <TicketProgressStepper status={ticket.status} />
      )}
    </Card>
  )
}
