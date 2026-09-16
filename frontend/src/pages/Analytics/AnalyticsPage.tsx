// Analytics Page – ANALYTICS-FR-001..003/005, VISION-FR-008..011
import { useState } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { format, parseISO } from 'date-fns'
import '@/utils/chartTheme'
import { CHART_COLORS, CHART_PALETTE, baseChartOptions } from '@/utils/chartTheme'
import { useZoneStore } from '@/store/zoneStore'
import { useFarmZones } from '@/hooks/useFarms'
import { useEnvSummary, useEnvCompare, useBirdCountTrends } from '@/hooks/useAnalytics'
import type { AnalyticsRange, EnvSummaryPoint } from '@/services/api/analytics'
import { Card } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { cn } from '@/utils/cn'
import { formatReturnRate } from '@/utils/helpers'

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '1h', label: '1 giờ' }, { value: '6h', label: '6 giờ' }, { value: '24h', label: '24 giờ' },
  { value: '7d', label: '7 ngày' }, { value: '30d', label: '30 ngày' },
]

const METRICS = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C' },
  { key: 'humidity', label: 'Độ ẩm', unit: '%' },
  { key: 'light_lux', label: 'Ánh sáng', unit: 'lux' },
  { key: 'nh3_ppm', label: 'NH3', unit: 'ppm' },
  { key: 'co2_ppm', label: 'CO2', unit: 'ppm' },
  { key: 'sound_db', label: 'Âm thanh', unit: 'dB' },
] as const
type MetricKey = typeof METRICS[number]['key']

const TABS = ['env', 'compare', 'bird'] as const
type Tab = typeof TABS[number]
const TAB_LABEL: Record<Tab, string> = { env: 'Môi trường', compare: 'So sánh Zone', bird: 'Đàn chim' }

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

// ── Tab con dùng chung: chọn metric + chọn khoảng thời gian ──────────────────

function MetricTabs({ metric, onChange }: { metric: MetricKey; onChange: (m: MetricKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {METRICS.map(m => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            metric === m.key ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

function RangeChips({ range, onChange }: { range: AnalyticsRange; onChange: (r: AnalyticsRange) => void }) {
  return (
    <div className="flex gap-1 rounded-full border border-warmGray/15 p-1">
      {RANGES.map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            range === r.value ? 'bg-charcoal text-white' : 'text-warmGray hover:bg-warmGray/10',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

function StatChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4', warn ? 'border-alertRed/30 bg-alertRed/5' : 'border-warmGray/15 bg-white')}>
      <p className="label-caption">{label}</p>
      <p className={cn('mt-1 text-2xl font-extrabold', warn ? 'text-alertRed' : 'text-charcoal')}>{value}</p>
    </div>
  )
}

function labelForRange(iso: string, range: AnalyticsRange): string {
  const date = parseISO(iso)
  return range === '7d' || range === '30d' ? format(date, 'dd/MM') : format(date, 'HH:mm')
}

function seriesStats(series: EnvSummaryPoint[], key: MetricKey): { min: number; max: number; avg: number } | null {
  const values = series.map(p => p[key]).filter((v): v is number => typeof v === 'number')
  if (values.length === 0) return null
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  }
}

const xAxisTicks = { autoSkip: true, maxRotation: 0, maxTicksLimit: 8 }

// ── Tab 1: Môi trường ─────────────────────────────────────────────────────

function EnvTab({
  zoneId, range, setRange, metric, setMetric,
}: { zoneId: string; range: AnalyticsRange; setRange: (r: AnalyticsRange) => void; metric: MetricKey; setMetric: (m: MetricKey) => void }) {
  const { data, isLoading } = useEnvSummary(zoneId, range)
  const metricDef = METRICS.find(m => m.key === metric)!
  const stats = data ? seriesStats(data.series, metric) : null

  const chartData = {
    labels: data?.series.map(p => labelForRange(p.timestamp, range)) ?? [],
    datasets: [{
      label: metricDef.label,
      data: data?.series.map(p => p[metric] ?? null) ?? [],
      borderColor: CHART_COLORS.charcoal,
      backgroundColor: 'rgba(39,35,31,0.06)',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
      spanGaps: true,
    }],
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetricTabs metric={metric} onChange={setMetric} />
        <RangeChips range={range} onChange={setRange} />
      </div>

      <Card size="lg">
        {isLoading ? (
          <LoadingSkeleton className="h-72 w-full" />
        ) : data && data.series.length > 0 ? (
          <div className="h-72">
            <Line
              data={chartData}
              options={{
                ...baseChartOptions,
                scales: {
                  x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...xAxisTicks } },
                  y: { ...baseChartOptions.scales.y, title: { display: true, text: metricDef.unit, color: CHART_COLORS.warmGray, font: { family: 'Inter', size: 11 } } },
                },
              } as ChartOptions<'line'>}
            />
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center text-sm text-warmGray">Chưa có dữ liệu trong khoảng thời gian này</div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatChip label="Thấp nhất" value={`${stats.min.toFixed(1)} ${metricDef.unit}`} />
          <StatChip label="Trung bình" value={`${stats.avg.toFixed(1)} ${metricDef.unit}`} />
          <StatChip label="Cao nhất" value={`${stats.max.toFixed(1)} ${metricDef.unit}`} />
        </div>
      )}
    </div>
  )
}

// ── Tab 2: So sánh Zone ───────────────────────────────────────────────────

function CompareTab({
  farmId, range, setRange, metric, setMetric,
}: { farmId: string | undefined; range: AnalyticsRange; setRange: (r: AnalyticsRange) => void; metric: MetricKey; setMetric: (m: MetricKey) => void }) {
  const { data: zones } = useFarmZones(farmId)
  const [selected, setSelected] = useState<string[]>([])
  const { data, isLoading } = useEnvCompare(selected, range)
  const metricDef = METRICS.find(m => m.key === metric)!

  function toggle(zoneId: string) {
    setSelected(s => (s.includes(zoneId) ? s.filter(z => z !== zoneId) : s.length < 6 ? [...s, zoneId] : s))
  }

  if (!farmId) {
    return (
      <EmptyState
        title="Chưa xác định trang trại"
        description="Chọn 1 zone ở thanh trên cùng trước — hệ thống dùng trang trại của zone đó để gợi ý danh sách so sánh."
      />
    )
  }

  const barData = {
    labels: data?.zones.map(z => z.zoneName) ?? [],
    datasets: [{
      label: metricDef.label,
      data: data?.zones.map(z => (metric === 'sound_db' ? null : z.metrics?.[metric] ?? null)) ?? [],
      backgroundColor: (data?.zones ?? []).map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
      borderRadius: 8,
    }],
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetricTabs metric={metric} onChange={setMetric} />
        <RangeChips range={range} onChange={setRange} />
      </div>

      <Card>
        <p className="label-caption mb-3">Chọn tối đa 6 zone để so sánh</p>
        <div className="flex flex-wrap gap-2">
          {zones?.map(zone => (
            <label
              key={zone._id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                selected.includes(zone._id) ? 'border-charcoal bg-charcoal text-white' : 'border-warmGray/20 text-charcoal hover:bg-warmGray/10',
              )}
            >
              <input type="checkbox" className="hidden" checked={selected.includes(zone._id)} onChange={() => toggle(zone._id)} />
              {zone.houseName} / {zone.name}
            </label>
          ))}
          {zones?.length === 0 && <p className="text-sm text-warmGray">Trang trại này chưa có zone nào.</p>}
        </div>
      </Card>

      {selected.length === 0 ? (
        <EmptyState title="Chưa chọn zone nào" description="Chọn ít nhất 1 zone ở trên để vẽ biểu đồ so sánh." />
      ) : isLoading ? (
        <LoadingSkeleton className="h-72 w-full" />
      ) : metric === 'sound_db' ? (
        <EmptyState title="Chưa hỗ trợ so sánh Âm thanh" description="API so sánh đa Zone hiện chỉ gồm nhiệt độ, độ ẩm, ánh sáng, NH3, CO2." />
      ) : (
        <Card size="lg">
          <div className="h-72">
            <Bar
              data={barData}
              options={{
                ...baseChartOptions,
                scales: {
                  x: { ...baseChartOptions.scales.x },
                  y: { ...baseChartOptions.scales.y, title: { display: true, text: metricDef.unit, color: CHART_COLORS.warmGray, font: { family: 'Inter', size: 11 } } },
                },
              } as ChartOptions<'bar'>}
            />
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Tab 3: Đàn chim (VISION-FR-008..011) ─────────────────────────────────

function BirdTab({ zoneId }: { zoneId: string }) {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useBirdCountTrends(zoneId, days)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RangeChips
          range={days === 7 ? '7d' : '30d'}
          onChange={r => setDays(r === '7d' ? 7 : 30)}
        />
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-72 w-full" />
      ) : !data || data.records.length === 0 ? (
        <EmptyState
          title="Chưa có dữ liệu đếm chim"
          description="Cần module VISION (Camera AI đếm chim, Raspberry Pi) hoạt động để có dữ liệu return rate."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatChip label="TB Return Rate" value={data.avg_return_rate !== null ? formatReturnRate(data.avg_return_rate) : '--'} />
            <StatChip label="Mới nhất" value={data.latest_return_rate !== null ? formatReturnRate(data.latest_return_rate) : '--'} />
            <StatChip
              label="Thay đổi"
              value={data.drop_percent !== null ? `${data.drop_percent > 0 ? '-' : '+'}${Math.abs(data.drop_percent).toFixed(1)}%` : '--'}
              warn={data.is_significant_drop}
            />
          </div>
          <Card size="lg">
            <div className="h-72">
              <Line
                data={{
                  labels: data.records.map(r => format(parseISO(r.date), 'dd/MM')),
                  datasets: [{
                    label: 'Return rate',
                    data: data.records.map(r => r.return_rate),
                    borderColor: CHART_COLORS.charcoal,
                    backgroundColor: 'rgba(39,35,31,0.06)',
                    fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2, spanGaps: true,
                  }],
                }}
                options={{
                  ...baseChartOptions,
                  scales: { x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...xAxisTicks } }, y: baseChartOptions.scales.y },
                } as ChartOptions<'line'>}
              />
            </div>
          </Card>
          {data.is_significant_drop && (
            <p className="rounded-xl bg-alertRed/10 px-3 py-2.5 text-sm font-medium text-alertRed">
              Return rate giảm hơn 20% so với trung bình — cân nhắc kiểm tra thiên địch hoặc sự cố hạ tầng (VISION-FR-011).
            </p>
          )}
        </>
      )}
    </div>
  )
}
