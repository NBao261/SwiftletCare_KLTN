/**
 * ControlPerfBlock — Khối 2: Hiệu năng điều khiển mờ & Dấu mốc tinh chỉnh
 * 6 KPI stat tiles + LineChart với ReferenceLine tuning event
 * SRS v2.1.4: ANALYTICS-FR-009, EXPERT-FR-005
 */
import { useState, useMemo } from 'react'
import { cn } from '@/lib/cn'
import { ArrowLeftRight } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, ResponsiveContainer,
} from 'recharts'
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

interface Props {
  range: PerfRange
  onRangeChange: (r: PerfRange) => void
  autonomyPct?: number
  data?: ControlPerformanceResponse
  isLoading?: boolean
}

export default function ControlPerfBlock({ range, onRangeChange, autonomyPct = 96.4, data, isLoading }: Props) {
  const [showComparison, setShowComparison] = useState(false)

  const seriesData = useMemo(() => {
    if (!data?.series || data.series.length === 0) return []
    return data.series.map(s => {
      const dt = new Date(s.timestamp)
      return {
        date: `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}`,
        hum: s.humidity,
        tmp: s.temperature,
      }
    })
  }, [data?.series])

  if (isLoading) return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-neutral-100 rounded-xl" />)}
      </div>
      <div className="h-48 bg-neutral-100 rounded-xl" />
    </div>
  )

  const stats = data?.stats
  const kpiTiles = [
    { label: 'Độ ẩm đạt chuẩn', value: stats?.humidityInRangePct != null ? `${stats.humidityInRangePct.toFixed(1)}%` : '—', sub: '', progress: stats?.humidityInRangePct ?? null, color: '#B5D32C' },
    { label: 'Nhiệt độ đạt chuẩn', value: stats?.temperatureInRangePct != null ? `${stats.temperatureInRangePct.toFixed(1)}%` : '—', sub: '', progress: stats?.temperatureInRangePct ?? null, color: '#B5D32C' },
    { label: 'Công suất phun sương TB', value: stats?.mistingAvgPct != null ? `${stats.mistingAvgPct.toFixed(1)}%` : '—', sub: '', progress: stats?.mistingAvgPct ?? null, color: '#27231F' },
    { label: 'Công suất Quạt TB', value: stats?.ventilationAvgPct != null ? `${stats.ventilationAvgPct.toFixed(1)}%` : '—', sub: '', progress: stats?.ventilationAvgPct ?? null, color: '#27231F' },
    { label: 'Tần suất đóng cắt Bơm', value: stats?.mistingSwitchesPerHour != null ? `${stats.mistingSwitchesPerHour.toFixed(1)} lần/h` : '—', sub: 'Tuổi thọ rơ-le tối ưu', progress: null, color: '#27231F' },
    { label: 'Tần suất đóng cắt Quạt', value: stats?.ventilationSwitchesPerHour != null ? `${stats.ventilationSwitchesPerHour.toFixed(1)} lần/h` : '—', sub: 'Tuổi thọ rơ-le tối ưu', progress: null, color: '#27231F' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-bold text-[#27231F]">Hiệu năng điều khiển mờ &amp; Dấu mốc tinh chỉnh</h2>
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

      {/* LineChart hiệu năng */}
      {seriesData.length === 0 ? (
        <div className="h-44 flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 text-center">
          <p className="text-xs font-semibold text-[#27231F]">Chưa có dữ liệu chuỗi thời gian hiệu năng</p>
          <p className="text-[11px] text-[#878380] mt-1">Hệ thống đang tích lũy dữ liệu điều khiển cho chu kỳ {RANGE_LABELS[range]}.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={seriesData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} />
            <YAxis domain={[70, 100]} tickCount={4} unit="%" tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} />
            {data?.tuning_changes?.[0] && (
              <ReferenceLine
                x={new Date(data.tuning_changes[0].changed_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                stroke="#27231F"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
            )}
            <Line type="monotone" dataKey="hum" name="Tỉ lệ đạt chuẩn độ ẩm" stroke="#27231F" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="tmp" name="Tỉ lệ đạt chuẩn nhiệt độ" stroke="#8BAF2A" strokeWidth={2} dot={false} />
            <Tooltip wrapperStyle={{ zIndex: 50 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v}%`]} />
            <Legend iconType="line" wrapperStyle={{ fontSize: 10 }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Modal đối chiếu đa Zone */}
      <ZoneComparisonModal isOpen={showComparison} onClose={() => setShowComparison(false)} />
    </div>
  )
}
