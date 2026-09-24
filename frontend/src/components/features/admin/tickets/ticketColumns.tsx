import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import ActionsMenu from '@/components/ui/ActionsMenu'
import { formatDate, formatRelativeTime } from '@/lib/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/constants/tickets'
import type { Ticket } from '@/types'

export interface TicketColumnHandlers {
  onView: (ticket: Ticket) => void
  /** TICKET-FR-005b — 3 thao tác can thiệp, cùng modal với trang chi tiết (AdminOverrideModals.tsx) */
  onReassign: (ticket: Ticket) => void
  onChangePriority: (ticket: Ticket) => void
  onReschedule: (ticket: Ticket) => void
}

export const ticketCode = (ticket: Ticket) => `#${ticket._id.slice(-6)}`
export const technicianName = (ticket: Ticket) =>
  typeof ticket.assigned_to === 'object' ? ticket.assigned_to.full_name : undefined

/**
 * Cột bảng Ticket (AdminTicketsPage) — cùng khuôn với userColumns.tsx/farmColumns.tsx.
 * `farmNames` tra từ GET /farms vì ticket chỉ có farm_id. Can thiệp không gate theo
 * trạng thái — quyền thường trực của Admin (TICKET-FR-005b), giống trang chi tiết.
 */
export function buildTicketColumns(
  handlers: TicketColumnHandlers,
  startIndex: number,
  farmNames: Map<string, string>,
): DataTableColumn<Ticket>[] {
  // Width theo % (DataTable là table-fixed) — TỔNG PHẢI = 100%: vượt quá thì cột cuối (Thao tác)
  // bị ép sát mép bảng. 5+20+12+8+13+12+10+10+10 = 100.
  return [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[5%]',
      render: (_t, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      key: 'type', header: 'Ticket', sortable: true, className: 'w-[20%]',
      render: (ticket) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link to={`/tickets/${ticket._id}`} className="truncate font-semibold text-charcoal hover:underline">
            {TICKET_TYPE_LABEL[ticket.type]}
          </Link>
          <p className="truncate text-xs text-warmGray" title={ticket.notes[0]?.content}>
            <span className="font-mono">{ticketCode(ticket)}</span>
            {ticket.notes[0] && ` · ${ticket.notes[0].content}`}
          </p>
        </div>
      ),
    },
    {
      key: 'farm', header: 'Trang trại', sortable: true, className: 'w-[12%]',
      render: (ticket) => (
        <Link to={`/system/farms/${ticket.farm_id}`} className="block truncate text-charcoal hover:underline">
          {farmNames.get(ticket.farm_id) ?? '—'}
        </Link>
      ),
    },
    {
      // Ưu tiên / Hạn xử lý / Ngày tạo sắp bằng nút "Sắp xếp:" cạnh bộ lọc (như trang Người dùng) — không lặp ở tiêu đề
      key: 'priority', header: 'Ưu tiên', align: 'center', className: 'w-[8%]',
      render: (ticket) => <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>,
    },
    {
      key: 'status', header: 'Trạng thái', sortable: true, className: 'w-[13%]',
      render: (ticket) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Badge tone={STATUS_TONE[ticket.status]} className="whitespace-nowrap">{STATUS_LABEL[ticket.status]}</Badge>
          {ticket.is_sla_breached && ticket.status !== 'CLOSED' && (
            <span className="text-xs font-semibold text-red-600">Quá hạn SLA</span>
          )}
        </div>
      ),
    },
    {
      key: 'technician', header: 'Kỹ thuật viên', sortable: true, className: 'w-[12%]',
      render: (ticket) => {
        const name = technicianName(ticket)
        return name
          ? <span className="block truncate text-charcoal" title={name}>{name}</span>
          // Chưa ai nhận = cần Admin gán — tô cam cho nổi giữa bảng
          : <span className="font-semibold text-orange-600">Chưa phân công</span>
      },
    },
    {
      key: 'due', header: 'Hạn xử lý', className: 'w-[10%] whitespace-nowrap',
      render: (ticket) => {
        if (ticket.status === 'CLOSED' || !ticket.sla_resolve_due_at) return <span className="text-warmGray">—</span>
        return (
          <span
            className={ticket.is_sla_breached ? 'font-semibold text-red-600' : 'text-charcoal'}
            title={formatDate(ticket.sla_resolve_due_at)}
          >
            {formatRelativeTime(ticket.sla_resolve_due_at)}
          </span>
        )
      },
    },
    {
      key: 'created_at', header: 'Ngày tạo', className: 'w-[10%] whitespace-nowrap',
      render: (ticket) => (
        <span className="text-warmGray" title={formatDate(ticket.created_at)}>{formatRelativeTime(ticket.created_at)}</span>
      ),
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[10%]',
      render: (ticket) => (
        <ActionsMenu
          items={[
            { label: 'Xem chi tiết', onClick: () => handlers.onView(ticket) },
            { label: 'Gán lại kỹ thuật viên', onClick: () => handlers.onReassign(ticket) },
            { label: 'Đổi độ ưu tiên', onClick: () => handlers.onChangePriority(ticket) },
            { label: 'Đổi lịch hẹn', onClick: () => handlers.onReschedule(ticket) },
          ]}
        />
      ),
    },
  ]
}
