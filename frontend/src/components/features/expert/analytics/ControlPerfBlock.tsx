/**
 * ControlPerfBlock — Khối 2: Hiệu năng điều khiển mờ & Dấu mốc tinh chỉnh
 * 6 KPI stat tiles + LineChart với ReferenceLine tuning event
 * SRS v2.1.4: ANALYTICS-FR-009, EXPERT-FR-005
 */
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { ArrowLeftRight } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, Legend, ResponsiveContainer,
} from 'recharts'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import ZoneComparisonModal from './ZoneComparisonModal'
import type { PerfRange } from '@/hooks/expert/useExpertAnalytics'
import type { ControlPerformanceResponse } from '@/types/expert.types'

const RANGES: PerfRange[] = ['1h', '6h', '24h', '7d', '30d']

const RANGE_LABELS: Record<PerfRange, string> = {
  '1h': '1 giờ',
  '6h': '6 giờ',
  '24h': '24 giờ',
  '7d': '7 ngày',
  '30d': '30 ngày',
}

const PERF_DATA = [
  { date: '08/10', hum: 85.2, tmp: 91.0 }, { date: '09/10', hum: 86.1, tmp: 92.5 },
  { date: '10/10', hum: 84.8, tmp: 93.0 }, { date: '11/10', hum: 83.9, tmp: 92.8 },
  { date: '12/10', hum: 85.5, tmp: 93.1 }, { date: '13/10', hum: 86.0, tmp: 93.5 },
  { date: '14/10', hum: 85.8, tmp: 94.0 }, { date: '15/10', hum: 86.5, tmp: 94.2 },
  { date: '16/10', hum: 89.5, tmp: 95.0 }, { date: '17/10', hum: 91.0, tmp: 95.1 },
  { date: '18/10', hum: 91.8, tmp: 95.2 }, { date: '19/10', hum: 92.4, tmp: 95.1 },
]

function TuningLabel(props: any) {
  const cx = props.viewBox?.x ?? 0
  const cy = props.viewBox?.y ?? 0
  return (
    <g>
      <rect x={cx - 165} y={cy + 4} width={330} height={20} rx={10} fill="#ECFFA9" stroke="#B5D32C" strokeWidth={1} />
      <text x={cx} y={cy + 17} fill="#27231F" fontSize={9.5} fontWeight={700} textAnchor="middle">
        15/10 14:30 — Chuyên gia giảm dải biên độ ẩm từ 8% xuống 6%RH
      </text>
    </g>
  )
}

interface Props {
  range: PerfRange
  onRangeChange: (r: PerfRange) => void
  autonomyPct?: number
  data?: ControlPerformanceResponse
  isLoading?: boolean
}

export default function ControlPerfBlock({ range, onRangeChange, autonomyPct = 96.4, data, isLoading }: Props) {
  const [showComparison, setShowComparison] = useState(false)
  if (isLoading) return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-neutral-100 rounded-xl" />)}
      </div>
      <div className="h-48 bg-neutral-100 rounded-xl" />
    </div>
  )

  const isMock = !data?.stats
  const stats = data?.stats

  const kpiTiles = [
    { label: 'Độ ẩm đạt chuẩn', value: stats?.humidityInRangePct != null ? `${stats.humidityInRangePct}%` : '92,4%', sub: '', progress: stats?.humidityInRangePct ?? 92, color: '#B5D32C' },
    { label: 'Nhiệt độ đạt chuẩn', value: stats?.temperatureInRangePct != null ? `${stats.temperatureInRangePct}%` : '95,1%', sub: '', progress: stats?.temperatureInRangePct ?? 95, color: '#B5D32C' },
    { label: 'Công suất phun sương TB', value: stats?.mistingAvgPct != null ? `${stats.mistingAvgPct}%` : '42,0%', sub: '', progress: stats?.mistingAvgPct ?? 42, color: '#27231F' },
    { label: 'Công suất Quạt TB', value: stats?.ventilationAvgPct != null ? `${stats.ventilationAvgPct}%` : '18,5%', sub: '', progress: stats?.ventilationAvgPct ?? 19, color: '#27231F' },
    { label: 'Tần suất đóng cắt Bơm', value: stats?.mistingSwitchesPerHour != null ? `${stats.mistingSwitchesPerHour} lần/h` : '3,2 lần/h', sub: 'Tuổi thọ rơ-le tối ưu', progress: null, color: '#27231F' },
    { label: 'Tần suất đóng cắt Quạt', value: stats?.ventilationSwitchesPerHour != null ? `${stats.ventilationSwitchesPerHour} lần/h` : '1,5 lần/h', sub: 'Tuổi thọ rơ-le tối ưu', progress: null, color: '#27231F' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-bold text-[#27231F]">Hiệu năng điều khiển mờ &amp; Dấu mốc tinh chỉnh</h2>
          {isMock && (
            <MockDataTooltip reason="Đang hiển thị thống kê hiệu năng mô phỏng do DB chưa tích lũy đủ chu kỳ telemetry." />
          )}
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-[#ECFFA9] text-[#4A5C00] border border-[#B5D32C] whitespace-nowrap">
            Tỷ lệ tự động AUTO ({RANGE_LABELS[range]}): {autonomyPct}%
          </span>
          <button
            type="button"
            onClick={() => setShowComparison(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-neutral-200 text-[#27231F] hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#27231F]" />
            So sánh đa Zone
          </button>
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5">
          {RANGES.map(r => (
            <button key={r} type="button" onClick={() => onRangeChange(r)}
              className={cn('px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150',
                range === r ? 'bg-[#27231F] text-white shadow-sm' : 'text-[#878380] hover:text-[#27231F]')}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 6 KPI stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiTiles.map(tile => (
          <div key={tile.label} className="bg-neutral-50 rounded-xl p-3 flex flex-col gap-1.5 border border-neutral-100">
            <p className="text-[11px] text-[#878380] leading-tight">{tile.label}</p>
            <p className="text-xl font-bold text-[#27231F] leading-tight tabular-nums">{tile.value}</p>
            {tile.sub && <p className="text-[10px] text-[#4A5C00] font-medium italic">{tile.sub}</p>}
            {tile.progress !== null && (
              <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${tile.progress}%`, backgroundColor: tile.color }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* LineChart hiệu năng + dấu mốc tinh chỉnh */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={PERF_DATA} margin={{ top: 28, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} />
          <YAxis domain={[75, 100]} tickCount={4} unit="%" tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} />
          <ReferenceArea x1="15/10" x2="19/10" fill="#F4FCE3" fillOpacity={0.8} />
          <ReferenceLine x="15/10" stroke="#27231F" strokeDasharray="4 3" strokeWidth={1.5} label={<TuningLabel />} />
          <Line type="monotone" dataKey="hum" name="Tỉ lệ đạt chuẩn độ ẩm (Tăng mạnh >92% sau tinh chỉnh)" stroke="#27231F" strokeWidth={2.2} dot={false} />
          <Line type="monotone" dataKey="tmp" name="Tỉ lệ đạt chuẩn nhiệt độ (Duy trì ổn định >95%)" stroke="#8BAF2A" strokeWidth={2.2} dot={false} />
          <Tooltip wrapperStyle={{ zIndex: 50 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v}%`]} />
          <Legend iconType="line" wrapperStyle={{ fontSize: 10 }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Modal đối chiếu đa Zone */}
      <ZoneComparisonModal isOpen={showComparison} onClose={() => setShowComparison(false)} />
    </div>
  )
}
