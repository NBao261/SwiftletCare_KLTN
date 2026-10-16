import { formatDate, formatDayTime, formatDuration } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import type { Ticket } from '@/types'

/**
 * Hạn SLA của 1 ticket trên AdminTicketDetailPage — cùng kiểu ô số StatTile ở trang Ticket: nhãn (không icon),
 * số lớn đếm ngược tới hạn xử lý (tính theo đồng hồ lúc render như cột "Thời gian SLA" của bảng), quá hạn thì
 * số + dòng phụ đỏ (khung vẫn trắng). Bên dưới là 2 mốc đầy đủ: hạn phản hồi + hạn xử lý (TICKET-FR-006).
 */
export default function TicketSlaCard({ ticket }: { ticket: Ticket }) {
  const closed = ticket.status === 'CLOSED'
  const leftMs = !closed && ticket.sla_resolve_due_at ? new Date(ticket.sla_resolve_due_at).getTime() - Date.now() : null
  const overdue = leftMs != null && leftMs < 0

  return (
    // Khung luôn trắng như các card khác — quá hạn chỉ tô đỏ số + dòng "Đã quá hạn xử lý"
    <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
      <p className="label-caption mb-2">{t('Thời gian SLA')}</p>
      <p className={cn('text-h1 font-extrabold leading-none tracking-tight', overdue ? 'text-alertRed' : 'text-charcoal')}>
        {leftMs != null ? formatDuration(leftMs) : '--'}
      </p>
      <p className={cn('mt-1.5 text-caption font-medium', overdue ? 'text-alertRed' : 'text-warmGray')}>
        {t(closed ? 'Ticket đã đóng' : leftMs == null ? 'Chưa có hạn xử lý' : overdue ? 'Đã quá hạn xử lý' : 'Còn lại tới hạn xử lý')}
      </p>

      <dl className="mt-4 flex flex-col gap-1.5 border-t border-warmGray/10 pt-3 text-small">
        {([['Hạn phản hồi', ticket.sla_response_due_at], ['Hạn xử lý', ticket.sla_resolve_due_at]] as const).map(([label, at]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-warmGray">{t(label)}</dt>
            <dd className="font-medium text-charcoal" title={at ? formatDate(at) : undefined}>{at ? formatDayTime(at) : '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
