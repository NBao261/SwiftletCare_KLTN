import { type DataTableColumn } from '@/components/ui'
import ActionsMenu from '@/components/ui/ActionsMenu'
import { cn } from '@/lib/cn'
import PriorityBadge from '@/components/common/PriorityBadge'
import TicketStatusBadge from '@/components/common/TicketStatusBadge'
import { formatHourMinute, formatStandardDate } from '@/lib/i18n'
import { isTicketFinished, ticketOrigin } from '@/components/features/farm-owner/tickets/tickets.constants'
import type { SupportTranslate } from '@/constants/support.i18n'
import type { Ticket } from '@/types'

interface ColumnLookups {
  // Tên farm, chưa tra được thì trả undefined
  farmName: (farmId: string) => string | undefined
  // Nhãn "Nhà / Zone", yêu cầu cấp farm thì trả undefined
  zoneLabel: (zoneId?: string) => string | undefined
  // Hàm dịch theo ngôn ngữ đang chọn
  translate: SupportTranslate
  // Thao tác cuối dòng: mở trang chi tiết, hoặc mở chi tiết kèm khung trao đổi
  onView: (ticket: Ticket) => void
  onChat: (ticket: Ticket) => void
  // Số thứ tự dòng đầu trang hiện tại = (trang - 1) × số dòng mỗi trang
  startIndex: number
}

// Lớp chữ ô 2 tầng
const LINE_1 = 'truncate text-sm text-charcoal'
const LINE_2 = 'truncate text-xs text-warmGray'
// Lớp xuống dòng thay vì cắt chữ
const WRAP = 'whitespace-normal break-words'
// Lớp đệm ô
const CELL = 'py-3.5'

function assigneeName(assigned: Ticket['assigned_to']): string | undefined {
  return typeof assigned === 'object' ? assigned.full_name : undefined
}

// Cột bảng yêu cầu
export function buildTicketColumns({ farmName, zoneLabel, translate, onView, onChat, startIndex }: ColumnLookups): DataTableColumn<Ticket>[] {
  return [
    {
      // Số thứ tự, nối tiếp qua các trang
      key: 'index', header: translate('col.index'), align: 'center', className: cn('w-[5%]', CELL),
      render: (_ticket, index) => <span className="tabular-nums text-sm text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      key: 'ticket', header: translate('col.ticket'), className: cn('w-[19%]', CELL),
      // Cột Ticket: tên loại + nguồn gốc ngắn
      render: ticket => (
        <div>
          <p className={cn(WRAP, 'text-sm font-bold text-charcoal')}>
            {translate(`type.${ticket.type}`)}
          </p>
          <p className={cn(WRAP, 'text-xs text-warmGray')}>{translate(`origin.${ticketOrigin(ticket)}`)}</p>
        </div>
      ),
    },
    {
      key: 'farm', header: translate('col.location'), className: cn('w-[16%]', CELL),
      render: ticket => (
        <div className="min-w-0">
          <p className={cn(LINE_1, 'font-medium')}>{farmName(ticket.farm_id) ?? translate('cell.unknownLocation')}</p>
          <p className={LINE_2}>{zoneLabel(ticket.zone_id) ?? translate('cell.wholeFarm')}</p>
        </div>
      ),
    },
    {
      key: 'status', header: translate('col.status'), className: cn('w-[16%]', CELL),
      // Cột trạng thái: 1 badge, quá hạn là tag chữ cam xuống dòng khi thiếu chỗ
      render: ticket => (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TicketStatusBadge ticket={ticket} />
          {ticket.status !== 'CLOSED' && ticket.is_sla_breached && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-safetyOrange">
              <span className="h-1.5 w-1.5 rounded-full bg-safetyOrange" aria-hidden />
              {translate('cell.overdue')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'priority', header: translate('col.priority'), className: cn('w-[10%]', CELL),
      render: ticket => <PriorityBadge priority={ticket.priority} isMuted={isTicketFinished(ticket)} />,
    },
    {
      key: 'assignee', header: translate('col.assignee'), className: cn('w-[14%]', CELL),
      render: ticket => {
        const name = assigneeName(ticket.assigned_to)
        return <p className={cn(WRAP, 'text-sm', name ? 'text-charcoal' : 'text-warmGray')}>{name ?? translate('cell.assigning')}</p>
      },
    },
    {
      key: 'time', header: translate('col.time'), className: cn('w-[11%]', CELL),
      render: ticket => {
        // Ticket lắp đặt/bảo trì hiện giờ hẹn, còn lại giờ tạo — 2 dòng ngày / giờ, không kèm chữ
        const shownTime = ticket.scheduled_visit_at ?? ticket.created_at
        return (
          <div className="min-w-0">
            <p className={cn(LINE_1, 'font-semibold tabular-nums')}>{formatStandardDate(shownTime)}</p>
            <p className={cn(LINE_2, 'tabular-nums')}>{formatHourMinute(shownTime)}</p>
          </div>
        )
      },
    },
    {
      // Menu ⋯ cuối dòng — chỉ bấm nút mới chuyển trang, bấm vào dòng không làm gì
      key: 'actions', header: translate('col.actions'), align: 'center', className: cn('w-[9%] whitespace-nowrap', CELL),
      render: ticket => (
        <ActionsMenu
          items={[
            { label: translate('action.view'), onClick: () => onView(ticket) },
            { label: translate('action.chat'), onClick: () => onChat(ticket) },
          ]}
        />
      ),
    },
  ]
}
