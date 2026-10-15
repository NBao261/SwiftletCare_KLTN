// TicketStatBar.tsx — 3 ô KPI tổng quan ticket của Technician.
// KPI endpoint là requireRole('ADMIN') → Technician nhận 403, nên tính từ tickets[] đã fetch
// (tối đa số bản ghi của stats query) — sub ghi rõ phạm vi để số liệu trung thực.
import { ClipboardTextIcon, HourglassIcon, WarningIcon } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { Ticket } from '@/types'
import { isSlaBreached } from './ticketHelpers'
import { cn } from '@/lib/cn'

interface Props {
  tickets: Ticket[]
}

interface CustomStatCardProps {
  icon: Icon
  iconColorClass: string
  alert?: boolean
  label: string
  value: string | number
  sub: string
}

function CustomTicketStatCard({ icon: TileIcon, iconColorClass, alert, label, value, sub }: CustomStatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border p-4 transition-all hover:shadow-md',
        alert ? 'border-alertRed/30 bg-white bg-gradient-to-b from-alertRed/[0.04] to-alertRed/[0.04]' : 'border-warmGray/15 bg-white',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-warmGray uppercase tracking-wider truncate">{label}</span>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warmGray/10', iconColorClass)}>
          <TileIcon size={16} weight="regular" />
        </div>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className={cn('text-[32px] font-extrabold leading-none tracking-tight', alert ? 'text-alertRed' : 'text-charcoal')}>
          {value}
        </p>
      </div>
      
      <p className="mt-1.5 truncate text-xs font-medium text-warmGray" title={sub}>{sub}</p>
    </div>
  )
}

export function TicketStatBar({ tickets }: Props) {
  const statsOpen     = tickets.filter(t => t.status !== 'CLOSED').length
  const statsBreached = tickets.filter(isSlaBreached).length
  const statsAwaiting = tickets.filter(t => t.status === 'AWAITING_FIELD_CONFIRMATION').length

  return (
    <section className="w-full rounded-[24px] border border-warmGray/15 bg-white p-4 shadow-sm">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <CustomTicketStatCard
          icon={ClipboardTextIcon}
          iconColorClass="text-charcoal"
          label="Đang mở"
          value={statsOpen}
          sub={`Trong ${tickets.length} ticket gần nhất`}
        />
        <CustomTicketStatCard
          icon={WarningIcon}
          iconColorClass={statsBreached > 0 ? 'text-alertRed' : 'text-charcoal'}
          alert={statsBreached > 0}
          label="Quá hạn SLA"
          value={statsBreached}
          sub="Cần xử lý ngay"
        />
        <CustomTicketStatCard
          icon={HourglassIcon}
          iconColorClass={statsAwaiting > 0 ? 'text-orange-600' : 'text-charcoal'}
          label="Chờ xác nhận"
          value={statsAwaiting}
          sub="Chờ chủ trại xác nhận"
        />
      </div>
    </section>
  )
}
