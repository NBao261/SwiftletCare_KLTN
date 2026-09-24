// TicketCard.tsx — Card hiển thị 1 ticket trong danh sách Technician
// Visual Elevation: priority dot, SLA ring, hover lift, slide-up animation
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { formatDate } from '@/lib/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL } from '@/constants/tickets'
import { isSlaBreached } from './ticketHelpers'
import { SlaRing } from './SlaRing'
import { STATUS_DOT_CLS } from './ticketListTypes'
import type { Ticket, TicketStatus } from '@/types'

// ── Priority dot ──────────────────────────────────────────────────────────────
const PRIORITY_DOT: Record<string, { bg: string; ring: string; label: string }> = {
  P1: { bg: 'bg-alertRed',       ring: 'ring-alertRed/20',       label: 'Khẩn cấp' },
  P2: { bg: 'bg-climateOrange',  ring: 'ring-climateOrange/20',  label: 'Cao' },
  P3: { bg: 'bg-warmGray',       ring: 'ring-warmGray/20',       label: 'Bình thường' },
}

function PriorityDot({ priority }: { priority: string }) {
  const d = PRIORITY_DOT[priority] ?? PRIORITY_DOT.P3
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded-full ${d.bg} ring-4 ${d.ring} ${priority === 'P1' ? 'animate-pulse-sla' : ''}`} />
      <span className="text-xs font-semibold text-warmGray">{priority} · {d.label}</span>
    </div>
  )
}

// ── Status dot badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TicketStatus }) {
  const statusDotCls = STATUS_DOT_CLS[status] ?? 'bg-warmGray'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-graphite/10 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal shadow-icon`}>
      <span className={`inline-block h-2 w-2 rounded-full ${statusDotCls}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────
interface TicketCardProps {
  ticket: Ticket
  onUpdateStatus: (ticket: Ticket) => void
  onReassign: (ticket: Ticket) => void
}

export function TicketCard({ ticket, onUpdateStatus, onReassign }: TicketCardProps) {
  const navigate = useNavigate()
  const breached = isSlaBreached(ticket)
  const isInstall = ticket.type === 'INSTALLATION' || ticket.type === 'MAINTENANCE'

  const actionItems: ActionsMenuItem[] = []
  if (ticket.status === 'NEW') {
    actionItems.push({ label: 'Tiếp nhận', onClick: () => onUpdateStatus(ticket) })
  }
  if (ticket.status !== 'CLOSED') {
    actionItems.push({ label: 'Cập nhật', onClick: () => onUpdateStatus(ticket) })
    actionItems.push({ label: 'Gán lại', onClick: () => onReassign(ticket) })
    if (isInstall) {
      actionItems.push({ label: 'Sửa ngày hẹn', onClick: () => navigate(`/tickets/${ticket._id}?action=reschedule`) })
    }
  }

  return (
    <Card
      className={`group flex flex-col gap-0 overflow-hidden p-0 transition-all duration-300 hover:shadow-dock hover:-translate-y-0.5 ${
        breached ? 'border-l-4 border-alertRed ring-1 ring-alertRed/10' : ''
      }`}
    >
      {/* Clickable body */}
      <div
        className="cursor-pointer p-5"
        role="button"
        tabIndex={0}
        aria-label={`Xem chi tiết ticket: ${TICKET_TYPE_LABEL[ticket.type]}`}
        onClick={() => navigate(`/tickets/${ticket._id}`)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/tickets/${ticket._id}`) }}
      >
        {/* Row 1: Priority + Type + Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <PriorityDot priority={ticket.priority} />
            <span className="text-base font-bold text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</span>
          </div>
          {actionItems.length > 0 && (
            <div className="shrink-0 -mr-2 -mt-1" onClick={e => e.stopPropagation()}>
              <ActionsMenu items={actionItems} />
            </div>
          )}
        </div>

        {/* Row 2: Status + SLA + Date */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-graphite/5 pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge status={ticket.status} />
            <SlaRing ticket={ticket} size={28} />
          </div>
          <span className="text-sm font-medium text-warmGray">{formatDate(ticket.created_at)}</span>
        </div>
      </div>
    </Card>
  )
}
