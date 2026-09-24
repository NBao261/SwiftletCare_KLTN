// Analytics Page – ANALYTICS-FR-001..003/005, VISION-FR-008..011
import { useRef, useState } from 'react'
import '@/lib/chartTheme'
import { useZoneStore } from '@/stores/zoneStore'
import { useZone } from '@/hooks/shared/useFarms'
import { useTelemetry } from '@/hooks/farm-owner/useTelemetry'
import EmptyState from '@/components/ui/EmptyState'
import EnvVariationCard from '@/components/features/farm-owner/analytics/EnvVariationCard'
import ZoneBalanceCard from '@/components/features/farm-owner/analytics/ZoneBalanceCard'
import BirdFlowCard from '@/components/features/farm-owner/analytics/BirdFlowCard'
import CorrelationCard from '@/components/features/farm-owner/analytics/CorrelationCard'
import CompareTab from '@/components/features/farm-owner/analytics/CompareTab'
import BirdTab from '@/components/features/farm-owner/analytics/BirdTab'
import { METRICS, type MetricKey } from '@/components/features/farm-owner/analytics/analytics.constants'
import type { AnalyticsRange } from '@/apis/farm-owner/analytics.api'

export default function FarmOwnerAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('24h')
  const [compareRange, setCompareRange] = useState<AnalyticsRange>('24h')
  const [compareMetric, setCompareMetric] = useState<MetricKey>(METRICS[0].key)
  const { selectedZoneId, selectedZoneName, selectedFarmId } = useZoneStore()
  const { data: zone } = useZone(selectedZoneId ?? undefined)
  const telemetry = useTelemetry(selectedZoneId ?? undefined)
  const correlationRef = useRef<HTMLDivElement>(null)

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
      <div className="min-w-0">
        <p className="label-caption">Khu vực đang xem</p>
        <p className="truncate text-2xl font-bold tracking-tight text-charcoal">{selectedZoneName}</p>
      </div>

      <EnvVariationCard
        zoneId={selectedZoneId}
        range={range}
        setRange={setRange}
        thresholds={zone?.thresholds}
        live={{ isLive: telemetry.isLive, nh3_ppm: telemetry.data.nh3_ppm, co2_ppm: telemetry.data.co2_ppm }}
      />

      <ZoneBalanceCard farmId={selectedFarmId ?? undefined} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BirdFlowCard onExpandCorrelation={() => correlationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        <CorrelationCard ref={correlationRef} zoneId={selectedZoneId} />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-h2 text-charcoal">So sánh môi trường giữa các Zone</h2>
        <CompareTab
          farmId={selectedFarmId ?? undefined}
          range={compareRange}
          setRange={setCompareRange}
          metric={compareMetric}
          setMetric={setCompareMetric}
        />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-h2 text-charcoal">Xu hướng đàn chim theo ngày</h2>
        <BirdTab zoneId={selectedZoneId} />
      </div>
    </div>
  )
}
