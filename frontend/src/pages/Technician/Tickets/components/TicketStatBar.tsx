// TicketStatBar.tsx — 3 stat cards hiển thị tổng quan tickets của Technician
// Visual Elevation: icon, accent ring, trend arrow, hover scale
import type { Ticket } from '@/types'
import { isSlaBreached } from './ticketHelpers'

interface Props {
  tickets: Ticket[]
}

interface StatCardProps {
  label: string
  value: number
  icon: string
  accent?: 'red' | 'orange' | 'default'
  total?: number
}

function StatCard({ label, value, icon, accent = 'default', total }: StatCardProps) {
  const ringClass =
    accent === 'red'    && value > 0 ? 'ring-2 ring-alertRed/25' :
    accent === 'orange' && value > 0 ? 'ring-2 ring-climateOrange/25' :
    ''

  const iconBg =
    accent === 'red'    ? 'bg-alertRed/10 text-alertRed' :
    accent === 'orange' ? 'bg-climateOrange/10 text-climateOrange' :
    'bg-limeMist/40 text-charcoal'

  const valueColor =
    accent === 'red'    && value > 0 ? 'text-alertRed'       :
    accent === 'orange' && value > 0 ? 'text-climateOrange'  :
    'text-charcoal'

  return (
    <div className={`group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-card transition-all duration-300 hover:shadow-dock hover:-translate-y-0.5 ${ringClass}`}>
      {/* Icon circle */}
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition-transform duration-300 group-hover:scale-110 ${iconBg}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-warmGray">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums ${valueColor} ${accent === 'red' && value > 0 ? 'animate-pulse-sla' : ''}`}>
            {value}
          </span>
          {total !== undefined && total > 0 && (
            <span className="text-xs text-warmGray">/ {total}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export function TicketStatBar({ tickets }: Props) {
  const statsOpen     = tickets.filter(t => t.status !== 'CLOSED').length
  const statsBreached = tickets.filter(isSlaBreached).length
  const statsAwaiting = tickets.filter(t => t.status === 'AWAITING_FIELD_CONFIRMATION').length

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Đang mở"      value={statsOpen}     icon="📋" total={tickets.length} />
      <StatCard label="Quá hạn SLA"  value={statsBreached} icon="🔴" accent="red" />
      <StatCard label="Chờ xác nhận" value={statsAwaiting} icon="⏳" accent="orange" />
    </div>
  )
}
