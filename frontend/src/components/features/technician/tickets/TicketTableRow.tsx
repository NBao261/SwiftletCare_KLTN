// TicketTableRow.tsx — Một hàng trong bảng danh sách ticket (Technician)
// Trách nhiệm duy nhất: render 1 row + hover action buttons.
// Bóc tách khỏi TechnicianTicketsPage để tái sử dụng và dễ test riêng.
import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { ArrowUpNarrowWide, ArrowDownWideNarrow, Eye } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { isSlaBreached, isTicketAssignee } from './ticketHelpers'
import { PRIORITY_DOT_CLS, STATUS_BADGE_CLS } from './ticketListTypes'
import { SlaRing } from './SlaRing'
import { TICKET_TYPE_LABEL, STATUS_LABEL } from '@/constants/tickets'
import { formatDate } from '@/lib/helpers'
import type { Ticket, TicketType, TicketPriority } from '@/types'

import { PRIORITY_LABEL } from '@/constants/sla'

// Sort icon — dùng SVG icon chuẩn thay vì ký tự unicode ↑↓
function SortIconIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return null
  return dir === 'asc'
    ? <ArrowUpNarrowWide size={12} strokeWidth={1.6} className="ml-1 inline-block" />
    : <ArrowDownWideNarrow size={12} strokeWidth={1.6} className="ml-1 inline-block" />
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
  const isClosed = ticket.status === 'CLOSED'

  // Nền: trễ SLA đậm nhất → P1 đang mở nhạt → còn lại trắng. Ticket đã đóng luôn nền trắng.
  const isUrgentOpen = !isClosed && ticket.priority === 'P1'
  const rowBg = isClosed ? 'bg-white'
    : breached ? 'bg-alertRed/[0.08]'
    : isUrgentOpen ? 'bg-alertRed/[0.04]'
    : 'bg-white'
  const statusBadgeCls = STATUS_BADGE_CLS[ticket.status] ?? 'bg-warmGray/10 text-warmGray'
  const priorityDotCls = PRIORITY_DOT_CLS[ticket.priority] ?? PRIORITY_DOT_CLS.P3
  // Viền trái theo trạng thái (ưu tiên: trễ SLA → đỏ). Đã đóng: không viền để không gây nhầm là việc cần xử lý.
  const accentCls = isClosed ? 'bg-transparent'
    : breached ? 'bg-alertRed'
    : ticket.status === 'NEW' ? 'bg-alertRed/70'
    : ticket.status === 'IN_PROGRESS' ? 'bg-climateOrange'
    : 'bg-graphite/50'

  const userId = useAuthStore(s => s.user?._id)
  // BE assertAssignee: chỉ Technician đang được gán mới xử lý được — ticket ở hàng đợi chung / của người khác chỉ xem
  const canAct = isTicketAssignee(ticket, userId)

  const actionItems: ActionsMenuItem[] = []
  if (canAct && !isClosed) {
    // NEW: "Tiếp nhận" là nút chính bên ngoài; các trạng thái khác có "Cập nhật" trong menu
    if (ticket.status !== 'NEW') actionItems.push({ label: 'Cập nhật', onClick: () => onUpdateStatus(ticket) })
    // Giữ như bản develop: mọi ticket chưa đóng (kể cả NEW) đều gán lại được
    actionItems.push({ label: 'Gán lại', onClick: () => onReassign(ticket) })
  }

  return (
    <tr
      className={`${rowBg} group animate-row-in cursor-pointer border-b border-warmGray/10 transition-colors duration-200 hover:bg-graphite/[0.03] motion-reduce:animate-none`}
      onClick={() => navigate(`/tickets/${ticket._id}`)}
      role="row"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      {/* Priority */}
      <td className="relative whitespace-nowrap py-3 pl-5 pr-3">
        <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${accentCls}`} />
        {/* Ticket đã đóng: giữ nguyên dữ liệu ưu tiên (lịch sử) nhưng làm mờ để không gây nhầm là việc cần xử lý */}
        <div className={`flex items-center gap-2 ${isClosed ? 'opacity-40 grayscale' : ''}`}>
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${priorityDotCls} ${ticket.priority === 'P1' && !isClosed ? 'animate-pulse-sla motion-reduce:animate-none' : ''}`} />
          <span className={`text-xs ${ticket.priority === 'P1' ? 'font-semibold text-alertRed' : 'font-medium text-charcoal'}`}>
            {PRIORITY_LABEL[ticket.priority as TicketPriority] || ticket.priority}
          </span>
        </div>
      </td>

      {/* Type */}
      <td className="max-w-[180px] truncate py-3 pr-3 text-sm font-medium text-charcoal">
        {TICKET_TYPE_LABEL[ticket.type as TicketType]}
      </td>

      {/* Status */}
      <td className="whitespace-nowrap py-3 pr-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeCls}`}>
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

      {/* Actions — chặn click không lan ra row */}
      <td className="py-3 pr-5 text-center" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1">
          {canAct && ticket.status === 'NEW' && (
            <button
              type="button"
              onClick={() => onUpdateStatus(ticket)}
              className="inline-flex items-center whitespace-nowrap rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-charcoal/85"
            >
              Tiếp nhận
            </button>
          )}
          {actionItems.length > 0 ? (
            <ActionsMenu items={actionItems} />
          ) : (
            <button
              type="button"
              title="Xem chi tiết"
              aria-label="Xem chi tiết ticket"
              onClick={() => navigate(`/tickets/${ticket._id}`)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-warmGray transition-colors hover:bg-graphite/5 hover:text-charcoal"
            >
              <Eye size={16} strokeWidth={1.6} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
})
