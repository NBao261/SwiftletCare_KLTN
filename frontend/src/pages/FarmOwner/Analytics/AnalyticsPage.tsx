// Analytics Page – ANALYTICS-FR-001..003/005, VISION-FR-008..011
import { useState } from 'react'
import '@/utils/chartTheme'
import { useZoneStore } from '@/store/zoneStore'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'
import { TABS, TAB_LABEL, type Tab, type MetricKey } from './constants'
import EnvTab from './tabs/EnvTab'
import CompareTab from './tabs/CompareTab'
import BirdTab from './tabs/BirdTab'
import type { AnalyticsRange } from '@/services/api/analytics'

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('env')
  const [range, setRange] = useState<AnalyticsRange>('24h')
  const [metric, setMetric] = useState<MetricKey>('temperature')
  const { selectedZoneId, selectedZoneName, selectedFarmId } = useZoneStore()

  if (!selectedZoneId) {
    return (
      <EmptyState
        title="Chưa chọn khu vực nào"
        description="Chọn khu vực ở thanh trên cùng để xem phân tích môi trường và đàn chim."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caption">Khu vực đang xem</p>
          <p className="truncate text-2xl font-bold tracking-tight text-charcoal">{selectedZoneName}</p>
        </div>
        <div className="flex gap-1 rounded-2xl bg-warmGray/10 p-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                tab === t ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'env' && <EnvTab zoneId={selectedZoneId} range={range} setRange={setRange} metric={metric} setMetric={setMetric} />}
      {tab === 'compare' && <CompareTab farmId={selectedFarmId ?? undefined} range={range} setRange={setRange} metric={metric} setMetric={setMetric} />}
      {tab === 'bird' && <BirdTab zoneId={selectedZoneId} />}
    </div>
  )
}
