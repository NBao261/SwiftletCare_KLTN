// TicketStatBar.tsx — 3 stat cards hiển thị tổng quan tickets của Technician
// Refactor: dùng useTicketsKpi() thay vì nhận tickets[] prop với limit:200
// Lý do: KPI endpoint trả aggregates toàn bộ — không bị giới hạn client-side limit
import { useTicketsKpi } from '@/hooks/useTickets'

interface StatCardProps {
  label: string
  value: number
  icon: string
  accent?: 'red' | 'orange' | 'default'
  total?: number
  loading?: boolean
}

function StatCard({ label, value, icon, accent = 'default', total, loading }: StatCardProps) {
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
          {loading ? (
            <span className="h-7 w-8 animate-pulse rounded bg-graphite/10" />
          ) : (
            <span className={`text-2xl font-bold tabular-nums ${valueColor} ${accent === 'red' && value > 0 ? 'animate-pulse-sla' : ''}`}>
              {value}
            </span>
          )}
          {!loading && total !== undefined && total > 0 && (
            <span className="text-xs text-warmGray">/ {total}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Stat bar dùng KPI endpoint — không bị giới hạn bởi client-side pagination.
 * API: GET /tickets/kpi → { byStatus: [{_id, count}], slaComplianceRate, ... }
 */
export function TicketStatBar() {
  const { data: kpi, isLoading } = useTicketsKpi()

  // Tính từ byStatus array
  const countByStatus = (status: string) =>
    kpi?.byStatus.find(s => s._id === status)?.count ?? 0

  const total       = kpi?.byStatus.reduce((sum, s) => sum + s.count, 0) ?? 0
  const closed      = countByStatus('CLOSED')
  const open        = total - closed
  // SLA compliance rate → suy ra số ticket vi phạm từ tỷ lệ và tổng
  const slaRate     = kpi?.slaComplianceRate ?? null
  const breached    = slaRate !== null ? Math.round(total * (1 - slaRate / 100)) : 0
  const awaiting    = countByStatus('AWAITING_FIELD_CONFIRMATION')

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Đang mở"      value={open}     icon="📋" total={total}  loading={isLoading} />
      <StatCard label="Quá hạn SLA"  value={breached} icon="🔴" accent="red"   loading={isLoading} />
      <StatCard label="Chờ xác nhận" value={awaiting} icon="⏳" accent="orange" loading={isLoading} />
    </div>
  )
}
