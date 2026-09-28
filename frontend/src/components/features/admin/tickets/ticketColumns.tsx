import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import ActionsMenu from '@/components/ui/ActionsMenu'
import { formatDate, formatRelativeTime, formatDuration } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { TICKET_TYPE_LABEL, STATUS_LABEL, PRIORITY_TONE } from '@/constants/tickets'
import { STATUS_BADGE_CLASS } from '@/components/features/admin/tickets/tickets.constants'
import type { Ticket } from '@/types'

export interface TicketColumnHandlers {
  onView: (ticket: Ticket) => void
  /** TICKET-FR-005b — 3 thao tác can thiệp, cùng modal với trang chi tiết (ChangePriorityModal / ReassignTicketModal / RescheduleModal) */
  onReassign: (ticket: Ticket) => void
  onChangePriority: (ticket: Ticket) => void
  onReschedule: (ticket: Ticket) => void
}

// Cột Ngày tạo: 2 dòng giờ:phút / ngày theo giờ VN (cùng timeZone với formatDate) — gọn hơn chuỗi đầy đủ có giây
const DAY_FORMAT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
const TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

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
  // bị ép sát mép bảng. 5+7+16+14+11+15+12+11+9 = 100. Trạng thái vừa badge dài nhất "Chờ xác nhận"
  // (nhãn rút gọn, xem cột status) — rộng hơn thì các badge ngắn bị bỏ trống xa cột Kỹ thuật viên.
  return [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[5%]',
      render: (_t, index) => <span className="tabular-nums text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      // Ngay sau STT: quét mức khẩn cấp trước khi đọc tên ticket.
      // Ưu tiên / Thời gian SLA / Ngày tạo sắp bằng nút "Sắp xếp:" cạnh bộ lọc (như trang Người dùng) — không lặp ở tiêu đề
      key: 'priority', header: 'Ưu tiên', align: 'center', className: 'w-[7%]',
      render: (ticket) => <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>,
    },
    {
      key: 'type', header: 'Ticket', sortable: true, className: 'w-[16%]',
      // Chỉ tên loại ticket — mã + ghi chú đầu tiên để ở tooltip (vẫn tìm được bằng ô search), xem đủ ở trang
      // chi tiết (bấm cả dòng — onRowClick ở AdminTicketsPage)
      render: (ticket) => (
        <span
          title={[ticketCode(ticket), ticket.notes[0]?.content].filter(Boolean).join(' · ')}
          className="block truncate font-semibold text-charcoal"
        >
          {TICKET_TYPE_LABEL[ticket.type]}
        </span>
      ),
    },
    {
      key: 'farm', header: 'Trang trại', sortable: true, className: 'w-[14%]',
      render: (ticket) => <span className="block truncate text-charcoal">{farmNames.get(ticket.farm_id) ?? '—'}</span>,
    },
    {
      key: 'status', header: 'Trạng thái', sortable: true, className: 'w-[11%]',
      // Chỉ loại trạng thái — quá hạn/còn bao lâu nằm ở cột "Thời gian SLA"
      // "Chờ xác nhận hiện trường" rút gọn thành "Chờ xác nhận" (đủ tên ở tooltip) để cột không phải rộng
      // theo nhãn dài nhất rồi bỏ trống với các nhãn ngắn "Mới"/"Đã đóng"
      render: (ticket) => (
        <Badge className={cn('whitespace-nowrap', STATUS_BADGE_CLASS[ticket.status])} title={STATUS_LABEL[ticket.status]}>
          {ticket.status === 'AWAITING_FIELD_CONFIRMATION' ? 'Chờ xác nhận' : STATUS_LABEL[ticket.status]}
        </Badge>
      ),
    },
    {
      key: 'technician', header: 'Kỹ thuật viên', sortable: true, className: 'w-[15%]',
      render: (ticket) => {
        const name = technicianName(ticket)
        return name
          ? <span className="block truncate text-charcoal" title={name}>{name}</span>
          // Chưa ai nhận = cần Admin gán — tô cam cho nổi giữa bảng
          : <span className="font-semibold text-orange-600">Chưa phân công</span>
      },
    },
    {
      key: 'due', header: 'Thời gian SLA', className: 'w-[12%] whitespace-nowrap',
      render: (ticket) => {
        if (ticket.status === 'CLOSED' || !ticket.sla_resolve_due_at) return <span className="text-warmGray">—</span>
        // Tính theo đồng hồ lúc render (không chờ cờ is_sla_breached của job) — "Quá hạn X" đỏ,
        // "Còn X" cam khi dưới 1 giờ để kịp can thiệp, còn lại charcoal. Giờ hạn đầy đủ ở tooltip.
        const leftMs = new Date(ticket.sla_resolve_due_at).getTime() - Date.now()
        const overdue = leftMs < 0
        return (
          <div className="flex flex-col" title={`Hạn: ${formatDate(ticket.sla_resolve_due_at)}`}>
            <span className={cn('text-small', overdue ? 'text-red-600' : 'text-warmGray')}>{overdue ? 'Quá hạn' : 'Còn'}</span>
            <span className={cn('font-semibold tabular-nums', overdue ? 'text-red-600' : leftMs < 3_600_000 ? 'text-orange-600' : 'text-charcoal')}>
              {formatDuration(leftMs)}
            </span>
          </div>
        )
      },
    },
    {
      key: 'created_at', header: 'Ngày tạo', className: 'w-[11%] whitespace-nowrap',
      render: (ticket) => {
        const created = new Date(ticket.created_at)
        return (
          <div className="flex flex-col tabular-nums" title={formatRelativeTime(ticket.created_at)}>
            <span className="text-charcoal">{TIME_FORMAT.format(created)}</span>
            <span className="text-small text-warmGray">{DAY_FORMAT.format(created)}</span>
          </div>
        )
      },
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[9%]',
      render: (ticket) => (
        // stopPropagation — dòng đã bấm-được (onRowClick), mở menu không được kéo theo điều hướng
        <div onClick={e => e.stopPropagation()}>
          <ActionsMenu
            items={[
              { label: 'Xem chi tiết', onClick: () => handlers.onView(ticket) },
              { label: 'Gán lại kỹ thuật viên', onClick: () => handlers.onReassign(ticket) },
              { label: 'Đổi độ ưu tiên', onClick: () => handlers.onChangePriority(ticket) },
              { label: 'Đổi lịch hẹn', onClick: () => handlers.onReschedule(ticket) },
            ]}
          />
        </div>
      ),
    },
  ]
}
