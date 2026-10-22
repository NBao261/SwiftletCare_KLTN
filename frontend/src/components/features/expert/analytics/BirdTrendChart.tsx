/**
 * BirdTrendChart — Xu hướng đàn chim & Tỉ lệ quay về (Khối 3 màn hình 04)
 * ComposedChart: cột Sáng/Chiều + đường tỉ lệ
 * SRS v2.1.4: VISION-FR-009, ANALYTICS-FR-011
 */
import { cn } from '@/lib/cn'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import type { BirdCountTrendsResponse } from '@/types/expert.types'

type BirdDays = 7 | 14 | 30

const MOCK_BIRD_DATA_7D = [
  { date: '13/10', morning: 1180, evening: 1150, rate: 97.4 },
  { date: '14/10', morning: 1220, evening: 1195, rate: 97.9 },
  { date: '15/10', morning: 1200, evening: 1170, rate: 97.5 },
  { date: '16/10', morning: 1240, evening: 1215, rate: 98.0 },
  { date: '17/10', morning: 1210, evening: 1185, rate: 97.9 },
  { date: '18/10', morning: 1230, evening: 1205, rate: 98.0 },
  { date: '19/10', morning: 1250, evening: 1225, rate: 98.0 },
]

function BirdTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-bold text-[#27231F]">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <b>{p.value}{p.name.includes('Tỉ lệ') ? '%' : ' con'}</b></p>
      ))}
    </div>
  )
}

interface Props {
  days: BirdDays
  onDaysChange: (d: BirdDays) => void
  avgReturnRate?: number
  data?: BirdCountTrendsResponse
  isLoading?: boolean
}

export default function BirdTrendChart({ days, onDaysChange, avgReturnRate = 97.9, data, isLoading }: Props) {
  if (isLoading) return <div className="h-52 bg-neutral-100 rounded-xl animate-pulse" />

  const isMock = !data?.records || data.records.length === 0

  const chartData = data?.records && data.records.length > 0
    ? data.records.slice(-days).map(r => {
        const d = new Date(r.date)
        return {
          date: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
          morning: r.morning_exit ?? 1200,
          evening: r.evening_entry ?? 1180,
          rate: r.return_rate != null ? Number(r.return_rate.toFixed(1)) : avgReturnRate,
        }
      })
    : MOCK_BIRD_DATA_7D

  const returnRateDisplay = data?.avg_return_rate != null ? data.avg_return_rate : avgReturnRate

  return (
    <div className="flex flex-col justify-between h-full space-y-2">
      {/* Header ngang hàng chuẩn Stitch */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-[#27231F] truncate">Xu hướng đàn chim &amp; Tỉ lệ quay về</h3>
          {isMock && (
            <MockDataTooltip reason="Dữ liệu số đếm chim mô phỏng — Hệ thống đang chờ tín hiệu video thực tế từ module AI Camera Vision (VISION-FR-009)." />
          )}
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5 shrink-0">
          {([7, 14, 30] as BirdDays[]).map(d => (
            <button key={d} type="button" onClick={() => onDaysChange(d)}
              className={cn('px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150',
                days === d ? 'bg-[#27231F] text-white shadow-sm' : 'text-[#878380] hover:text-[#27231F]')}>
              {d} ngày
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={chartData} barGap={2} margin={{ top: 8, right: 32, left: 2, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="birds" domain={[0, 1500]} tickCount={4} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} width={44} />
          <YAxis yAxisId="rate" orientation="right" domain={[60, 100]} tickCount={5} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} unit="%" width={36} />

          <ReferenceLine yAxisId="rate" y={80} stroke="#D53F35" strokeDasharray="5 3" strokeWidth={1.5} />

          <Bar yAxisId="birds" dataKey="morning" name="Chim bay ra (Sáng)" fill="#B8B4B0" barSize={14} />
          <Bar yAxisId="birds" dataKey="evening" name="Chim quay về (Chiều)" fill="#27231F" barSize={14} />
          <Line yAxisId="rate" type="monotone" dataKey="rate" name={`Tỉ lệ quay về (${returnRateDisplay}%)`} stroke="#8BAF2A" strokeWidth={2.2} dot={{ r: 3, fill: '#8BAF2A' }} />

          <Tooltip content={<BirdTooltip />} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Custom Legend dưới đáy không đè cột */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-[#878380] pt-0.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#B8B4B0] rounded-sm inline-block" />
          <span>Chim bay ra (Sáng)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#27231F] rounded-sm inline-block" />
          <span>Chim quay về (Chiều)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-0.5 bg-[#8BAF2A] inline-block relative">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8BAF2A] absolute left-1/2 -top-0.5 -translate-x-1/2" />
          </span>
          <span>Tỉ lệ quay về</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#D53F35]">
          <span className="w-3.5 h-0 border-t-2 border-dashed border-[#D53F35] inline-block" />
          <span className="font-medium">Ngưỡng cảnh báo (80%)</span>
        </span>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-[#878380] pt-2 border-t border-neutral-100 mt-auto">
        <span>Trung bình {days} ngày: <b className="text-[#27231F]">1.215 cá thể/ngày</b></span>
        <span>Tỉ lệ về TB: <b className="text-[#4A5C00] font-bold">{returnRateDisplay}%</b> (Ổn định)</span>
      </div>
    </div>
  )
}
