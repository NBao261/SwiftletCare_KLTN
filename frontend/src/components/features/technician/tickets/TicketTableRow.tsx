// TicketTableRow.tsx — Một hàng trong bảng danh sách ticket (Technician)
// Trách nhiệm duy nhất: render 1 row + hover action buttons.
// Bóc tách khỏi TechnicianTicketsPage để tái sử dụng và dễ test riêng.
import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { IconSortAsc, IconSortDesc } from '@/components/ui/icons'
import { isSlaBreached } from './ticketHelpers'
import { PRIORITY_DOT_CLS, STATUS_DOT_CLS } from './ticketListTypes'
import { SlaRing } from './SlaRing'
import { TICKET_TYPE_LABEL, STATUS_LABEL } from '@/constants/tickets'
import { formatDate } from '@/lib/helpers'
import type { Ticket, TicketType } from '@/types'

// Sort icon — dùng SVG icon chuẩn thay vì ký tự unicode ↑↓
function SortIconIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return null
  return dir === 'asc'
    ? <IconSortAsc width={12} height={12} className="ml-1 inline-block" />
    : <IconSortDesc width={12} height={12} className="ml-1 inline-block" />
}

// Export SortIcon để TicketTableView dùng trong header
export { SortIconIndicator as SortIcon }

interface Props {
  ticket: Ticket
  index: number
  onUpdateStatus: (t: Ticket) => void
  onReassign: (t: Ticket) => void
}

export const TicketTableRow = memo(function TicketTableRow({
  ticket, index, onUpdateStatus, onReassign,
}: Props) {
  const navigate = useNavigate()
  const breached = isSlaBreached(ticket)

  const rowBg      = breached ? 'bg-alertRed/[0.03]' : index % 2 === 0 ? 'bg-white' : 'bg-graphite/[0.02]'
  const dotCls     = PRIORITY_DOT_CLS[ticket.priority] ?? PRIORITY_DOT_CLS.P3
  const statusDotCls = STATUS_DOT_CLS[ticket.status] ?? 'bg-warmGray'

  return (
    <tr
      className={`${rowBg} group cursor-pointer transition-all duration-200 hover:bg-limeMist/10 hover:shadow-sm`}
      onClick={() => navigate(`/tickets/${ticket._id}`)}
      role="row"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Priority */}
      <td className="whitespace-nowrap py-3 pl-5 pr-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-3 w-3 rounded-full ring-4 ${dotCls} ${
              ticket.priority === 'P1' ? 'animate-pulse-sla' : ''
            }`}
          />
          <span className="text-xs font-bold text-charcoal">{ticket.priority}</span>
        </div>
      </td>

      {/* Type */}
      <td className="max-w-[180px] truncate py-3 pr-3 text-sm font-medium text-charcoal">
        {TICKET_TYPE_LABEL[ticket.type as TicketType]}
      </td>

      {/* Status */}
      <td className="whitespace-nowrap py-3 pr-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-graphite/10 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal shadow-icon">
          <span className={`inline-block h-2 w-2 rounded-full ${statusDotCls}`} />
          {STATUS_LABEL[ticket.status]}
        </span>
      </td>

      {/* SLA Ring */}
      <td className="whitespace-nowrap py-3 pr-3">
        <SlaRing ticket={ticket} size={28} />
      </td>

      {/* Date */}
      <td className="whitespace-nowrap py-3 pr-3 text-sm text-warmGray">
        {formatDate(ticket.created_at)}
      </td>

      {/* Latest note */}
      <td className="w-full max-w-0 py-3 pr-3">
        {ticket.notes[0] && (
          <p className="truncate text-sm text-warmGray">💬 {ticket.notes[0].content}</p>
        )}
      </td>

      {/* Actions — chặn click không lan ra row */}
      <td className="w-1 whitespace-nowrap py-3 pr-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5 opacity-0 transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {ticket.status === 'NEW' && (
            <Button
              size="sm"
              onClick={() => onUpdateStatus(ticket)}
              className="h-7 px-3 text-xs"
            >
              Tiếp nhận
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onUpdateStatus(ticket)}
            disabled={ticket.status === 'CLOSED'}
            className="h-7 px-3 text-xs"
          >
            Cập nhật
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onReassign(ticket)}
            disabled={ticket.status === 'CLOSED'}
            className="h-7 px-3 text-xs"
          >
            Gán lại
          </Button>
        </div>
      </td>
    </tr>
  )
})
