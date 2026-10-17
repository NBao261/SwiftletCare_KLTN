import type { ReactNode } from 'react'
import { CalendarIcon, CheckCircleIcon, ClockIcon, MapPinIcon, UserIcon, WarningIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui'
import Avatar from '@/components/ui/Avatar'
import { useTranslation } from '@/hooks/common/useTranslation'
import { supportDict } from '@/constants/support.i18n'
import { cn } from '@/lib/cn'
import type { Ticket } from '@/types'

interface TicketInfoCardProps {
  ticket: Ticket
  farmName: string
  zoneLabel?: string
  farmAddress?: string
}

function Row({ icon, label, children, danger }: { icon: ReactNode; label: string; children: ReactNode; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="flex shrink-0 items-center gap-2 text-warmGray">{icon}{label}</dt>
      <dd className={cn('text-right font-medium', danger ? 'text-safetyOrange' : 'text-charcoal')}>{children}</dd>
    </div>
  )
}

// Thẻ thông tin người phụ trách, vị trí và mốc thời gian
export default function TicketInfoCard({ ticket, farmName, zoneLabel, farmAddress }: TicketInfoCardProps) {
  const { t, dateTime } = useTranslation(supportDict)
  const assignee = typeof ticket.assigned_to === 'object' ? ticket.assigned_to : undefined
  const open = ticket.status !== 'CLOSED'

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <h2 className="text-h2 text-charcoal">{t('info.title')}</h2>

      <dl className="flex flex-col divide-y divide-warmGray/10 text-sm">
        <Row icon={<UserIcon size={16} />} label={t('info.assignee')}>
          {/* Kỹ thuật viên: tên, email — chủ nhà yến liên hệ qua khung Trao đổi, không hiện số điện thoại */}
          {assignee ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="flex items-center gap-2 font-semibold">
                <Avatar name={assignee.full_name} className="h-6 w-6 text-[11px]" />
                {assignee.full_name}
              </span>
              <span className="text-xs font-normal text-gray-600">{assignee.email}</span>
            </div>
          ) : t('cell.assigning')}
        </Row>
        <Row icon={<MapPinIcon size={16} />} label={t('info.location')}>
          {/* Vị trí: farm, nhà / zone, địa chỉ farm */}
          <span className="block font-semibold">{farmName}</span>
          <span className="block text-xs font-normal text-gray-600">{zoneLabel ?? t('cell.wholeFarm')}</span>
          {farmAddress && (
            <span className="mt-0.5 flex items-start justify-end gap-1 text-xs font-normal leading-relaxed text-gray-600">
              <MapPinIcon size={12} className="mt-0.5 shrink-0" aria-hidden />
              {farmAddress}
            </span>
          )}
        </Row>
        {ticket.scheduled_visit_at && (
          <Row icon={<CalendarIcon size={16} />} label={t('info.visit')}>{dateTime(ticket.scheduled_visit_at)}</Row>
        )}
        {ticket.responded_at && (
          <Row icon={<CheckCircleIcon size={16} />} label={t('info.responded')}>{dateTime(ticket.responded_at)}</Row>
        )}
        {open && ticket.sla_resolve_due_at && (
          <Row icon={<ClockIcon size={16} />} label={t('info.due')} danger={ticket.is_sla_breached}>
            {dateTime(ticket.sla_resolve_due_at)}
          </Row>
        )}
        {ticket.closed_at && (
          <Row icon={<CheckCircleIcon size={16} />} label={ticket.cancelled_at ? t('info.cancelledAt') : t('info.closedAt')}>{dateTime(ticket.closed_at)}</Row>
        )}
      </dl>

      {(ticket.is_sla_response_breached || (open && ticket.is_sla_breached) || ticket.escalated_at) && (
        <div className="flex flex-wrap gap-2">
          {ticket.is_sla_response_breached && <Flag>{t('info.flagResponseLate')}</Flag>}
          {open && ticket.is_sla_breached && <Flag>{t('info.flagOverdue')}</Flag>}
          {ticket.escalated_at && <Flag>{t('info.flagEscalated')}</Flag>}
        </div>
      )}
    </Card>
  )
}

function Flag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-safetyOrange/10 px-2.5 py-1 text-small font-semibold text-safetyOrange">
      <WarningIcon size={14} weight="bold" />
      {children}
    </span>
  )
}
