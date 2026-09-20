// TicketCard.tsx — Card hiển thị 1 ticket trong danh sách Technician
// Visual Elevation: priority dot, SLA ring, hover lift, slide-up animation
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'
import { Card } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL } from '@/constants/tickets'
import { isSlaBreached } from './ticketHelpers'
import { SlaRing } from './SlaRing'
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
const STATUS_DOT_COLOR: Record<string, string> = {
  NEW: 'bg-charcoal',
  IN_PROGRESS: 'bg-climateOrange',
  AWAITING_FIELD_CONFIRMATION: 'bg-limeMist',
  CLOSED: 'bg-warmGray',
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-graphite/10 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal shadow-icon`}>
      <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT_COLOR[status] ?? 'bg-warmGray'}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

// ── Inline accept button (chỉ khi status=NEW) ─────────────────────────────────
function AcceptButton({ ticketId }: { ticketId: string }) {
  const push = useToastStore(s => s.push)
  const queryClient = useQueryClient()
  const mut = useMutation({
    mutationFn: () => ticketApi.updateStatus(ticketId, 'IN_PROGRESS', 'Kỹ thuật viên đã tiếp nhận ticket.'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      push('Đã tiếp nhận ticket')
    },
    onError: (err) => push(getApiErrorMessage(err, 'Cập nhật thất bại'), 'error'),
  })
  return (
    <button
      onClick={e => { e.stopPropagation(); mut.mutate() }}
      disabled={mut.isPending}
      className="rounded-full bg-charcoal px-4 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-charcoal/90 hover:shadow-icon active:scale-95 disabled:opacity-50"
    >
      {mut.isPending ? (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Đang xử lý…
        </span>
      ) : 'Tiếp nhận'}
    </button>
  )
}

// ── Action button ─────────────────────────────────────────────────
function ActionBtn({ label, onClick, disabled }: { label: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-graphite/15 px-3.5 py-1.5 text-sm font-medium text-charcoal transition-all duration-200 hover:border-charcoal/30 hover:bg-graphite/5 hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
  const breached = isSlaBreached(ticket)
  const isInstall = ticket.type === 'INSTALLATION' || ticket.type === 'MAINTENANCE'

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
        {/* Row 1: Priority + Type + Status */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <PriorityDot priority={ticket.priority} />
            <span className="text-base font-bold text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</span>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        {/* Row 2: SLA Ring + Date */}
        <div className="mt-3 flex items-center justify-between">
          <SlaRing ticket={ticket} size={32} />
          <span className="text-xs text-warmGray">{formatDate(ticket.created_at)}</span>
        </div>

        {/* Row 3: Note preview */}
        {ticket.notes[0] && (
          <p className="mt-2.5 truncate rounded-lg bg-graphite/[0.03] px-3 py-2 text-sm text-warmGray">
            💬 {ticket.notes[0].content}
          </p>
        )}
      </div>

      {/* Action bar — M1: disable Cập nhật + Gán lại khi CLOSED */}
      <div className="flex flex-wrap gap-2 border-t border-graphite/[0.08] bg-graphite/[0.02] px-5 py-3">
        {ticket.status === 'NEW' && <AcceptButton ticketId={ticket._id} />}

        <ActionBtn
          label="✏️ Cập nhật"
          onClick={e => { e.stopPropagation(); onUpdateStatus(ticket) }}
          disabled={ticket.status === 'CLOSED'}
        />
        <ActionBtn
          label="🔄 Gán lại"
          onClick={e => { e.stopPropagation(); onReassign(ticket) }}
          disabled={ticket.status === 'CLOSED'}
        />
        {isInstall && (
          <ActionBtn
            label="📅 Sửa ngày hẹn"
            onClick={e => { e.stopPropagation(); navigate(`/tickets/${ticket._id}?action=reschedule`) }}
            disabled={ticket.status === 'CLOSED'}
          />
        )}
      </div>
    </Card>
  )
}
