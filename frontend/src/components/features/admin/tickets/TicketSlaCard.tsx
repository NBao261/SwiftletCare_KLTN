import { TimerIcon } from '@phosphor-icons/react'
import { formatDate, formatDuration } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import type { Ticket } from '@/types'

/**
 * Hạn SLA của 1 ticket trên AdminTicketDetailPage — cùng kiểu ô số StatTile ở trang Ticket: nhãn + icon tròn,
 * số lớn đếm ngược tới hạn xử lý (tính theo đồng hồ lúc render như cột "Thời gian SLA" của bảng), quá hạn thì
 * cả ô đỏ nhạt. Bên dưới là 2 mốc đầy đủ: hạn phản hồi + hạn xử lý (TICKET-FR-006).
 */
export default function TicketSlaCard({ ticket }: { ticket: Ticket }) {
  const closed = ticket.status === 'CLOSED'
  const leftMs = !closed && ticket.sla_resolve_due_at ? new Date(ticket.sla_resolve_due_at).getTime() - Date.now() : null
  const overdue = leftMs != null && leftMs < 0

  return (
    <section
      className={cn(
        'rounded-2xl border p-5 shadow-card',
        // Quá hạn: nền trắng đặc + lớp đỏ mờ phủ lên — cùng màu ô cảnh báo StatTile; chỉ đỏ mờ thì lẫn nền xám của trang
        overdue ? 'border-alertRed/30 bg-white bg-gradient-to-b from-alertRed/[0.04] to-alertRed/[0.04]' : 'border-warmGray/15 bg-white',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="label-caption">Thời gian SLA</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', overdue ? 'bg-alertRed text-white' : 'bg-accent-300 text-charcoal')}>
          <TimerIcon size={14} weight="bold" />
        </span>
      </div>
      <p className={cn('text-h1 font-extrabold leading-none tracking-tight tabular-nums', overdue ? 'text-alertRed' : 'text-charcoal')}>
        {leftMs != null ? formatDuration(leftMs) : '--'}
      </p>
      <p className={cn('mt-1.5 text-caption font-medium', overdue ? 'text-alertRed' : 'text-warmGray')}>
        {closed ? 'Ticket đã đóng' : leftMs == null ? 'Chưa có hạn xử lý' : overdue ? 'Đã quá hạn xử lý' : 'Còn lại tới hạn xử lý'}
      </p>

      <dl className="mt-4 flex flex-col gap-1.5 border-t border-warmGray/10 pt-3 text-small">
        {([['Hạn phản hồi', ticket.sla_response_due_at], ['Hạn xử lý', ticket.sla_resolve_due_at]] as const).map(([label, at]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-warmGray">{label}</dt>
            <dd className="font-medium tabular-nums text-charcoal">{at ? formatDate(at) : '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
