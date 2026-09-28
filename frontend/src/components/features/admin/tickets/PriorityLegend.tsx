import { Link } from 'react-router-dom'
import { ArrowRightIcon, FlagIcon } from '@phosphor-icons/react'
import { useSlaHours } from '@/hooks/admin/useSystem'
import { formatDuration } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { SLA_PRIORITIES, PRIORITY_LABEL } from '@/constants/sla'
import type { TicketPriority } from '@/types'

const HOUR_MS = 3_600_000

/** Cùng họ màu PRIORITY_TONE/PRIORITY_ICON_CLASS (đỏ/cam/xám), đậm hơn: dòng nền nhạt + ô P đặc chữ trắng */
const PRIORITY_ROW: Record<TicketPriority, { row: string; badge: string }> = {
  P1: { row: 'bg-red-50', badge: 'bg-red-500 text-white' },
  P2: { row: 'bg-orange-50', badge: 'bg-orange-500 text-white' },
  P3: { row: 'bg-gray-100', badge: 'bg-graphite text-white' },
}

/**
 * Card "Mức ưu tiên & hạn SLA" cạnh bảng Kỹ thuật viên (TicketInsights) — nhãn theo SRS (PRIORITY_LABEL),
 * hạn phản hồi/xử lý lấy từ SLA đang cấu hình (GET /system/settings/sla, TICKET-FR-006) chứ không ghi
 * cứng, nên đổi SLA ở Cài đặt hệ thống thì card tự khớp. Icon-box theo PRIORITY_ICON_CLASS như SlaCard.
 */
export default function PriorityLegend({ className }: { className?: string }) {
  const { data: sla } = useSlaHours()

  return (
    <section className={cn('flex flex-col rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card', className)}>
      {/* Tiêu đề card text-h2 (FE_Design §2.8) + chú thích bên dưới — cùng khuôn card Kỹ thuật viên;
          link "Cấu hình" là hàng riêng dưới 3 mức, để tiêu đề không bị bẻ đôi trong cột 21rem */}
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
          <FlagIcon size={20} weight="bold" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-h2 text-charcoal">Mức ưu tiên & hạn SLA</h2>
          <p className="text-small text-graphite">Hạn phản hồi và xử lý theo từng mức</p>
        </div>
      </div>

      <ul className="flex flex-1 flex-col justify-between gap-2">
        {SLA_PRIORITIES.map(p => (
          <li key={p} className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2.5', PRIORITY_ROW[p].row)}>
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-small font-bold', PRIORITY_ROW[p].badge)}>
              {p}
            </span>
            <span className="min-w-0 flex-1 truncate text-body font-semibold text-charcoal">{PRIORITY_LABEL[p]}</span>
            <div className="flex gap-3 text-right">
              {([['Phản hồi', 'response_hours'], ['Xử lý', 'resolve_hours']] as const).map(([label, key]) => (
                <div key={key} className="w-16 whitespace-nowrap">
                  <p className="label-caption">{label}</p>
                  <p className="text-body font-semibold tabular-nums text-charcoal">{sla ? formatDuration(sla[p][key] * HOUR_MS) : '--'}</p>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <Link to="/system/settings" className="group mt-3 inline-flex items-center gap-1 self-end text-small font-semibold text-charcoal hover:underline">
        Cấu hình
        <ArrowRightIcon size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  )
}
