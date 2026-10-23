/**
 * Màn hình 04_Analytics_Forecast_v3 — Phân tích & Dự báo (Page Shell)
 * Orchestrate: 4 Khối Recharts Charts
 * SRS v2.1.4: ANALYTICS-FR-008/009/011, VISION-FR-009
 */
import { useZoneStore } from '@/stores/zoneStore'
import ForecastChartPanel from '@/components/features/expert/analytics/ForecastChartPanel'
import ControlPerfBlock from '@/components/features/expert/analytics/ControlPerfBlock'
import BirdTrendChart from '@/components/features/expert/analytics/BirdTrendChart'
import HarvestHistoryCard from '@/components/features/expert/analytics/HarvestHistoryCard'
import {
  useHoltForecast,
  useControlPerformance,
  useAutonomy,
  useBirdCountTrends,
  useHarvestBatches,
  usePerfRange,
  useBirdRange,
} from '@/hooks/expert/useExpertAnalytics'

export default function ExpertAnalyticsPage() {
  const { selectedZoneId } = useZoneStore()
  const zoneId = selectedZoneId ?? undefined

  const { range, setRange } = usePerfRange()
  const { days, setDays } = useBirdRange()

  // Data hooks
  const forecast = useHoltForecast(zoneId)
  const perf = useControlPerformance(zoneId, range)
  const autonomy = useAutonomy(zoneId, range)
  const birdTrends = useBirdCountTrends(zoneId, days)
  const harvests = useHarvestBatches(zoneId)

  return (
    <div className="relative w-full flex-1 flex flex-col gap-5">
      <div className="w-full max-w-screen-xl mx-auto space-y-5">
        {/* Khối 1 — Dự báo vi khí hậu 60 phút */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
          <ForecastChartPanel
            data={forecast.data}
            isLoading={forecast.isLoading}
          />
        </div>

        {/* Khối 2 — Hiệu năng điều khiển mờ */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
          <ControlPerfBlock
            range={range} onRangeChange={setRange}
            autonomyPct={autonomy.data?.auto_mode_pct != null ? Number(autonomy.data.auto_mode_pct.toFixed(1)) : 0}
            data={perf.data}
            isLoading={perf.isLoading}
          />
        </div>

        {/* Khối 3 + 4 — Bird trend (trái) + Harvest (phải) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 flex flex-col">
            <BirdTrendChart
              days={days} onDaysChange={setDays}
              data={birdTrends.data}
              isLoading={birdTrends.isLoading}
            />
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 flex flex-col">
            <HarvestHistoryCard
              batches={harvests.data}
              isLoading={harvests.isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
