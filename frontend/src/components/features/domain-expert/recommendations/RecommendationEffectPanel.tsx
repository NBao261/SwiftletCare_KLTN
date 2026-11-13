import type { RecommendationEffect } from '@/types/expert.types'
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable'

interface Props {
  effects: RecommendationEffect[]
}

const COLUMNS: DataTableColumn<RecommendationEffect>[] = [
  {
    key: 'rule_name',
    header: 'Luật',
    render: row => <span className="font-medium text-charcoal">{row.rule_name}</span>,
  },
  {
    key: 'total_generated',
    header: 'Tạo',
    align: 'right',
    render: row => <span className="text-warmGray">{row.total_generated}</span>,
  },
  {
    key: 'total_accepted',
    header: 'Chấp nhận',
    align: 'right',
    render: row => <span className="text-warmGray">{row.total_accepted}</span>,
  },
  {
    key: 'total_improved',
    header: 'Cải thiện',
    align: 'right',
    render: row => <span className="font-semibold text-green-700">{row.total_improved}</span>,
  },
]

export default function RecommendationEffectPanel({ effects }: Props) {
  const totals = effects.reduce(
    (acc, e) => ({
      generated: acc.generated + e.total_generated,
      accepted:  acc.accepted  + e.total_accepted,
      improved:  acc.improved  + e.total_improved,
    }),
    { generated: 0, accepted: 0, improved: 0 },
  )

  return (
    <div className="space-y-4">
      {/* KPI tổng */}
      <div className="grid grid-cols-3 gap-3">
        <KpiTile label="Đã tạo" value={totals.generated} colorClass="text-blue-600" />
        <KpiTile label="Đã chấp nhận" value={totals.accepted} colorClass="text-green-600" />
        <KpiTile label="Có cải thiện" value={totals.improved} colorClass="text-emerald-600" />
      </div>

      <DataTable
        columns={COLUMNS}
        rows={effects}
        getRowKey={e => e.rule_id}
        emptyMessage="Chưa có dữ liệu hiệu quả"
      />
    </div>
  )
}

function KpiTile({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="rounded-2xl border border-warmGray/15 bg-white px-3 py-3 text-center space-y-1 shadow-card">
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-warmGray">{label}</p>
    </div>
  )
}
