import { useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { Camera } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { useBirdCount, useScopeZones } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import { useSyncedState } from '@/hooks/common/useSyncedState'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { LOCALE } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const RANGES = [
  { days: 7, labelKey: 'bird.range7' },
  { days: 14, labelKey: 'bird.range14' },
  { days: 30, labelKey: 'bird.range30' },
  { days: 90, labelKey: 'bird.range90' },
] as const

const chartOptions = {
  ...baseChartOptions,
  plugins: { ...baseChartOptions.plugins, legend: { display: false } },
} as ChartOptions<'bar'>

interface BirdVisionCardProps {
  farmId: string
  houseOptions: SelectMenuOption<string>[]
  globalHouseId: string
}

// Chart thống kê chim
export default function BirdVisionCard({ farmId, houseOptions, globalHouseId }: BirdVisionCardProps) {
  const { t, num, lang } = useTranslation(dashboardDict)
  const [days, setDays] = useState<number>(7)
  const [choice, setChoice] = useSyncedState(globalHouseId)
  const houseId = houseOptions.some(option => option.value === choice) ? choice : ''
  const { zones } = useScopeZones(farmId, houseId)
  const zoneIds = useMemo(() => zones.map(zone => zone._id), [zones])

  const { summary, isLoading, isError } = useBirdCount(zoneIds, days)
  const { current, total, deltaPercent, avgReturnRate } = summary

  const chartData = useMemo(() => ({
    labels: current.map(record => new Date(`${record.date}T00:00:00Z`).toLocaleDateString(LOCALE[lang], { day: '2-digit', month: '2-digit', timeZone: 'UTC' })),
    datasets: [
      { label: t('bird.legendEntry'), data: current.map(record => record.evening_entry), backgroundColor: CHART_COLORS.charcoal, borderRadius: 4, maxBarThickness: 18 },
      { label: t('bird.legendExit'), data: current.map(record => record.morning_exit), backgroundColor: CHART_COLORS.limeBright, borderRadius: 4, maxBarThickness: 18 },
    ],
  }), [current, t, lang])

  return (
    <Card size="lg" className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-charcoal" />
          <p className="label-caption">{t('bird.caption')}</p>
        </div>
        <SelectMenu ariaLabel={t('bird.scopeLabel')} value={houseId} options={houseOptions} onChange={setChoice} className="w-40 justify-between" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="leading-none">
          <span className="text-[34px] font-extrabold tracking-tight text-charcoal">{num(total)}</span>
          <span className="ml-2 text-sm font-medium text-warmGray">{t('bird.total')}</span>
        </p>
        {deltaPercent !== undefined && (
          <Badge tone={deltaPercent >= 0 ? 'positive' : 'warning'}>
            {deltaPercent >= 0 ? '+' : ''}{num(deltaPercent, 1)}% {t('bird.delta')}
          </Badge>
        )}
      </div>

      <div className="flex gap-1 rounded-2xl bg-warmGray/10 p-1">
        {RANGES.map(range => (
          <button
            key={range.days}
            onClick={() => setDays(range.days)}
            className={cn(
              'flex-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors',
              days === range.days ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
            )}
          >
            {t(range.labelKey)}
          </button>
        ))}
      </div>

      <div className="h-56">
        {isLoading ? (
          <LoadingSkeleton count={1} className="h-56 w-full" />
        ) : isError ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-warmGray/30 text-sm text-warmGray">
            {t('bird.error')}
          </div>
        ) : current.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-warmGray/30 px-6 text-center">
            <Camera width={22} height={22} className="text-warmGray" />
            <p className="text-sm font-semibold text-charcoal">{t('bird.emptyTitle')}</p>
            <p className="max-w-sm text-xs text-warmGray">{t('bird.emptyDesc')}</p>
          </div>
        ) : (
          <Bar data={chartData} options={chartOptions} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-warmGray/10 pt-3 text-xs text-warmGray">
        <div className="flex flex-wrap items-center gap-3">
          <LegendDot colorClass="bg-charcoal" label={t('bird.legendEntry')} />
          <LegendDot colorClass="bg-lime-500" label={t('bird.legendExit')} />
        </div>
        {avgReturnRate !== undefined && (
          <span className="flex items-center gap-1.5 font-medium">
            <Camera width={13} height={13} />
            {t('bird.returnRate', { n: num(avgReturnRate, 1) })}
          </span>
        )}
      </div>
    </Card>
  )
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', colorClass)} />
      {label}
    </span>
  )
}
