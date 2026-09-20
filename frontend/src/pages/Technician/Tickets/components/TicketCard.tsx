// TicketCard.tsx — Card hiển thị 1 ticket trong danh sách Technician
// Bao gồm: priority/type/status badges, SLA countdown, action bar
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'
import { Badge, Card } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/constants/tickets'
import { isSlaBreached, formatSlaCountdown, getSlaUrgency } from './ticketHelpers'
import type { Ticket, TicketStatus } from '@/types'

// ── Inline accept button (chỉ khi status=NEW) ─────────────────────────────────
interface AcceptButtonProps {
  ticketId: string
  newStatus: TicketStatus
  note: string
}

function AcceptButton({ ticketId, newStatus, note }: AcceptButtonProps) {
  const push = useToastStore(s => s.push)
  const queryClient = useQueryClient()
  const mut = useMutation({
    mutationFn: () => ticketApi.updateStatus(ticketId, newStatus, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      push(`Đã chuyển sang: ${STATUS_LABEL[newStatus]}`)
    },
    onError: (err) => push(getApiErrorMessage(err, 'Cập nhật thất bại'), 'error'),
  })
  return (
    <button
      onClick={e => { e.stopPropagation(); mut.mutate() }}
      disabled={mut.isPending}
      className="rounded-full bg-charcoal px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-charcoal/90 disabled:opacity-50"
    >
      {mut.isPending ? '…' : 'Tiếp nhận'}
    </button>
  )
}

// ── Action button (Cập nhật / Yêu cầu gán lại / Sửa ngày hẹn) ───────────────
interface ActionBtnProps {
  label: string
  onClick: (e: React.MouseEvent) => void
}

function ActionBtn({ label, onClick }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-graphite/20 px-3.5 py-1.5 text-sm font-medium text-charcoal hover:bg-graphite/10"
    >
      {label}
    </button>
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
  const sla = formatSlaCountdown(ticket)
  const breached = isSlaBreached(ticket)
  const urgency = getSlaUrgency(ticket)
  const isInstall = ticket.type === 'INSTALLATION' || ticket.type === 'MAINTENANCE'

  const slaColorClass =
    urgency === 'breached' ? 'text-alertRed' :
    urgency === 'critical' ? 'font-bold text-alertRed' :
    urgency === 'warning'  ? 'font-bold text-climateOrange' :
    'text-warmGray'

  return (
    <Card
      className={`flex flex-col gap-0 overflow-hidden p-0 transition-shadow hover:shadow-dock ${
        breached ? 'border-l-4 border-alertRed ring-1 ring-alertRed/20' : ''
      }`}
    >
      {/* Clickable body → navigate to detail (a11y: keyboard + screen reader) */}
      <div
        className="cursor-pointer p-5"
        role="button"
        tabIndex={0}
        aria-label={`Xem chi tiết ticket: ${TICKET_TYPE_LABEL[ticket.type]}`}
        onClick={() => navigate(`/tickets/${ticket._id}`)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/tickets/${ticket._id}`) }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
          <span className="font-semibold text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</span>
          <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
        </div>

        <div className="mt-2 flex items-center gap-4">
          <span className={`text-sm font-medium ${slaColorClass}`}>
            {sla.text}
          </span>
          <span className="text-xs text-warmGray">{formatDate(ticket.created_at)}</span>
        </div>

        {ticket.notes[0] && (
          <p className="mt-1.5 truncate text-sm text-warmGray">{ticket.notes[0].content}</p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 border-t border-graphite/10 bg-graphite/[0.03] px-5 py-3">
        {ticket.status === 'NEW' && (
          <AcceptButton
            ticketId={ticket._id}
            newStatus="IN_PROGRESS"
            note="Kỹ thuật viên đã tiếp nhận ticket."
          />
        )}

        <ActionBtn
          label="Cập nhật"
          onClick={e => { e.stopPropagation(); onUpdateStatus(ticket) }}
        />

        <ActionBtn
          label="Yêu cầu gán lại"
          onClick={e => { e.stopPropagation(); onReassign(ticket) }}
        />

        {isInstall && (
          <ActionBtn
            label="Sửa ngày hẹn"
            onClick={e => { e.stopPropagation(); navigate(`/tickets/${ticket._id}?action=reschedule`) }}
          />
        )}
      </div>
    </Card>
  )
}
