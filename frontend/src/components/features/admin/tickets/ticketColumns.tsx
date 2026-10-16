import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import ActionsMenu from '@/components/ui/ActionsMenu'
import { formatDate, formatRelativeTime, formatDuration } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { TICKET_TYPE_LABEL, STATUS_LABEL, PRIORITY_TONE } from '@/constants/tickets'
import { PRIORITY_LABEL } from '@/constants/sla'
import { STATUS_BADGE_CLASS } from '@/components/features/admin/tickets/tickets.constants'
import type { Ticket, TicketStatus, SortDirection } from '@/types'

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

const STATUS_ORDER = Object.keys(STATUS_LABEL) as TicketStatus[]
export type TicketSortKey = 'type' | 'farm' | 'priority' | 'status' | 'technician' | 'due' | 'created_at'
// Mặc định: mới nhất lên đầu (ngày tạo giảm dần). Chọn "Ưu tiên" ở nút Sắp xếp thì theo mức CẦN XỬ LÝ: chưa đóng
// Khẩn cấp → Cao → Thường, cùng mức thì hạn SLA gần nhất lên trước, đã đóng xuống cuối (xem sortTickets).
export const DEFAULT_TICKET_SORT_BY: TicketSortKey = 'created_at'
export const DEFAULT_TICKET_SORT_DIR: SortDirection = 'desc'
/**
 * Nút "Sắp xếp:" cạnh bộ lọc — như trang Người dùng. 3 trường khẩn cấp/thời gian Admin
 * hay sắp nhất. Tiêu đề cột không bấm sắp được — chỉ dùng nút này.
 */
export const TICKET_SORT_FIELDS: { key: TicketSortKey; label: string }[] = [
  { key: 'priority', label: 'Ưu tiên' },
  { key: 'created_at', label: 'Ngày tạo' },
  { key: 'due', label: 'Thời gian SLA' },
]

function sortValue(t: Ticket, key: TicketSortKey, farmNames: Map<string, string>): string | number {
  switch (key) {
    case 'type': return TICKET_TYPE_LABEL[t.type]
    case 'farm': return farmNames.get(t.farm_id) ?? ''
    case 'priority': return t.priority // "P1" < "P2" < "P3" đúng thứ tự khẩn cấp
    case 'status': return STATUS_ORDER.indexOf(t.status)
    case 'technician': return technicianName(t) ?? '￿' // chưa phân công xếp cuối khi tăng dần
    case 'due': return t.status === 'CLOSED' || !t.sla_resolve_due_at ? '￿' : t.sla_resolve_due_at
    case 'created_at': return t.created_at
  }
}

/** Sắp xếp tại chỗ — dùng chung bảng Ticket (AdminTicketsPage) và Ticket gần nhất (trang chi tiết Farm) */
export function sortTickets(list: Ticket[], sortBy: TicketSortKey, sortDir: SortDirection, farmNames: Map<string, string>) {
  const sign = sortDir === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    if (sortBy === 'priority') {
      // Sắp theo "cần xử lý": ticket đã đóng luôn xuống cuối (dù chiều nào) — Khẩn cấp đã đóng không còn việc gì
      const ca = a.status === 'CLOSED', cb = b.status === 'CLOSED'
      if (ca !== cb) return ca ? 1 : -1
      // Cùng mức ưu tiên: hạn SLA gần nhất lên trước (sắp trễ thì xử lý trước); không có hạn thì giữ thứ tự cũ
      if (a.priority === b.priority) {
        const da = a.sla_resolve_due_at ?? '￿', db = b.sla_resolve_due_at ?? '￿'
        return da.localeCompare(db)
      }
    }
    const va = sortValue(a, sortBy, farmNames), vb = sortValue(b, sortBy, farmNames)
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'vi')) * sign
  })
}

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
  // bị ép sát mép bảng. 5+9+16+13+10+15+13+11+8 = 100 — mỗi cột vừa nội dung dài nhất của nó, không dư khe trống:
  // Ticket 16% vừa "Lỗi thiết bị chấp hành", Trạng thái 10% vừa badge "Chờ xác nhận" (nhãn rút gọn), Thời gian SLA 13%
  // vừa "23 ngày 14 giờ" (trước 11% bị tràn), Ngày tạo 11% vừa "24/09/2026", Thao tác 8% chỉ chứa nút ⋮.
  return [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[5%]',
      render: (_t, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      // Ngay sau STT: quét mức khẩn cấp trước khi đọc tên ticket.
      // Ưu tiên / Thời gian SLA / Ngày tạo sắp bằng nút "Sắp xếp:" cạnh bộ lọc (như trang Người dùng) — không lặp ở tiêu đề
      // Chỉ chữ ý nghĩa "Khẩn cấp/Cao/Thường" (không mã P1/P2/P3) — thay card chú giải "Mức ưu tiên & hạn SLA" đã bỏ;
      // mã P1/P2/P3 ở tooltip để đối chiếu cấu hình SLA
      key: 'priority', header: 'Ưu tiên', className: 'w-[9%]',
      render: (ticket) => (
        <Badge tone={PRIORITY_TONE[ticket.priority]} className="whitespace-nowrap" title={ticket.priority}>
          {PRIORITY_LABEL[ticket.priority]}
        </Badge>
      ),
    },
    {
      // 17%: vừa đủ cho tên loại dài nhất ("Lỗi thiết bị chấp hành", "Thiết bị mất kết nối") hiện trọn ở màn hình
      // thường, không để khe trống lớn trước cột Trang trại — text-fade chỉ còn tác dụng khi bảng bị ép hẹp
      key: 'type', header: 'Ticket', className: 'w-[16%]',
      // Chỉ tên loại ticket — mã + ghi chú đầu tiên để ở tooltip (vẫn tìm được bằng ô search), xem đủ ở trang
      // chi tiết (bấm cả dòng — onRowClick ở AdminTicketsPage)
      render: (ticket) => (
        // Tên dài mờ dần (text-fade) như bảng Dashboard Farm Owner; tooltip có đủ tên + mã + ghi chú đầu
        <span
          title={[TICKET_TYPE_LABEL[ticket.type], ticketCode(ticket), ticket.notes[0]?.content].filter(Boolean).join(' · ')}
          className="text-fade font-semibold text-charcoal"
        >
          {TICKET_TYPE_LABEL[ticket.type]}
        </span>
      ),
    },
    {
      key: 'farm', header: 'Trang trại', className: 'w-[13%]',
      render: (ticket) => {
        const farm = farmNames.get(ticket.farm_id) ?? '—'
        return <span className="block truncate text-charcoal" title={farm}>{farm}</span>
      },
    },
    {
      key: 'status', header: 'Trạng thái', className: 'w-[10%]',
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
      key: 'technician', header: 'Kỹ thuật viên', className: 'w-[15%]',
      render: (ticket) => {
        const name = technicianName(ticket)
        return name
          ? <span className="block truncate text-charcoal" title={name}>{name}</span>
          // Chưa ai nhận = cần Admin gán — tô cam cho nổi giữa bảng
          : <span className="font-semibold text-climateOrange">{t('Chưa phân công')}</span>
      },
    },
    {
      key: 'due', header: 'Thời gian SLA', className: 'w-[13%] whitespace-nowrap',
      render: (ticket) => {
        if (ticket.status === 'CLOSED' || !ticket.sla_resolve_due_at) return <span className="text-warmGray">—</span>
        // Tính theo đồng hồ lúc render (không chờ cờ is_sla_breached của job) — "Quá hạn X" đỏ,
        // "Còn X" cam khi dưới 1 giờ để kịp can thiệp, còn lại charcoal. Giờ hạn đầy đủ ở tooltip.
        const leftMs = new Date(ticket.sla_resolve_due_at).getTime() - Date.now()
        const overdue = leftMs < 0
        return (
          <div className="flex flex-col" title={`${t('Hạn')}: ${formatDate(ticket.sla_resolve_due_at)}`}>
            <span className={cn('text-small', overdue ? 'text-red-600' : 'text-warmGray')}>{t(overdue ? 'Quá hạn' : 'Còn')}</span>
            <span className={cn('font-semibold', overdue ? 'text-red-600' : leftMs < 3_600_000 ? 'text-orange-600' : 'text-charcoal')}>
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
          <div className="flex flex-col" title={formatRelativeTime(ticket.created_at)}>
            <span className="font-semibold text-charcoal">{TIME_FORMAT.format(created)}</span>
            <span className="text-small text-warmGray">{DAY_FORMAT.format(created)}</span>
          </div>
        )
      },
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[8%]',
      render: (ticket) => (
        // stopPropagation — dòng đã bấm-được (onRowClick), mở menu bằng chuột/bàn phím không được kéo theo điều hướng
        <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <ActionsMenu
            // Ticket đã đóng: chỉ "Xem chi tiết" — 3 thao tác can thiệp chỉ dành cho ticket còn mở (xem AdminTicketDetailPage)
            items={[
              { label: 'Xem chi tiết', onClick: () => handlers.onView(ticket) },
              ...(ticket.status === 'CLOSED' ? [] : [
                { label: 'Gán lại kỹ thuật viên', onClick: () => handlers.onReassign(ticket) },
                { label: 'Đổi độ ưu tiên', onClick: () => handlers.onChangePriority(ticket) },
                { label: 'Đổi lịch hẹn', onClick: () => handlers.onReschedule(ticket) },
              ]),
            ]}
          />
        </div>
      ),
    },
  ]
}
