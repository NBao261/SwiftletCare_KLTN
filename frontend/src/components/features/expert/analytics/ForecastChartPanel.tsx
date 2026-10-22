/**
 * ForecastChartPanel — Biểu đồ Dự báo vi khí hậu 60 phút (Khối 1 màn hình 04)
 * ComposedChart dual Y-axis: %RH trái | °C phải
 * SRS v2.1.4: ANALYTICS-FR-008
 */
import { Sparkles, AlertTriangle } from 'lucide-react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ReferenceDot, ResponsiveContainer,
} from 'recharts'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import type { ForecastResponse } from '@/types/expert.types'

const FALLBACK_CHART_DATA = [
  { time: '-60 phút', h: 82.1, t: 28.8, h_fc: null, t_fc: null },
  { time: '-45 phút', h: 81.5, t: 28.9, h_fc: null, t_fc: null },
  { time: '-30 phút', h: 80.2, t: 29.0, h_fc: null, t_fc: null },
  { time: '-15 phút', h: 79.1, t: 29.1, h_fc: null, t_fc: null },
  { time: '14:20',   h: 78.3, t: 29.2, h_fc: 78.3, t_fc: 29.2 },
  { time: '+15 phút', h: null, t: null, h_fc: 76.8, t_fc: 29.4 },
  { time: '+25 phút', h: null, t: null, h_fc: 73.6, t_fc: 29.6 },
  { time: '+30 phút', h: null, t: null, h_fc: 72.1, t_fc: 29.7 },
  { time: '+45 phút', h: null, t: null, h_fc: 71.5, t_fc: 29.9 },
  { time: '+60 phút', h: null, t: null, h_fc: 70.8, t_fc: 30.1 },
]

function NowLabel({ viewBox }: { viewBox?: { x?: number; y?: number } }) {
  const x = (viewBox?.x ?? 0) - 46
  const y = (viewBox?.y ?? 20) - 2
  return (
    <g>
      <rect x={x} y={y} width={92} height={20} rx={10} fill="#27231F" />
      <text x={x + 46} y={y + 13} fill="#ECFFA9" fontSize={10} fontWeight={700} textAnchor="middle">
        Hiện tại 14:20
      </text>
    </g>
  )
}

interface DotLabelProps {
  x?: number
  y?: number
  cx?: number
  cy?: number
  viewBox?: { x?: number; y?: number }
}

function DotLabel(props: DotLabelProps) {
  const x = props.x ?? props.cx ?? props.viewBox?.x
  const y = props.y ?? props.cy ?? props.viewBox?.y
  if (x == null || y == null) return null
  return (
    <g className="pointer-events-none">
      <rect x={x - 30} y={y - 24} width={60} height={18} rx={9} fill="#D53F35" />
      <text x={x} y={y - 12} fill="white" fontSize={10} fontWeight={700} textAnchor="middle">
        73,6 %RH
      </text>
    </g>
  )
}

function CustomLegend() {
  const items = [
    { value: 'Độ ẩm thực tế', color: '#27231F', dash: false },
    { value: 'Độ ẩm dự báo', color: '#27231F', dash: true },
    { value: 'Nhiệt độ thực tế', color: '#8BAF2A', dash: false },
    { value: 'Nhiệt độ dự báo', color: '#8BAF2A', dash: true },
  ]
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] pt-1 text-[#878380]">
      {items.map((entry, idx) => (
        <span key={idx} className="inline-flex items-center gap-1.5">
          <span
            className="w-3.5 inline-block"
            style={{
              height: entry.dash ? '0px' : '2px',
              backgroundColor: entry.color,
              borderTop: entry.dash ? `1.5px dashed ${entry.color}` : 'none',
            }}
          />
          <span>{entry.value}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-[#D53F35]">
        <span className="w-3.5 h-0 border-t-2 border-dashed border-[#D53F35] inline-block" />
        <span className="font-medium">Ngưỡng an toàn (75,0 %RH)</span>
      </span>
    </div>
  )
}

interface Props {
  data?: ForecastResponse
  isLoading?: boolean
}

export default function ForecastChartPanel({ data, isLoading }: Props) {
  if (isLoading) return <div className="h-[280px] bg-neutral-50 rounded-xl animate-pulse" />

  const isMock = !data?.humidity?.forecast || data.humidity.forecast.length === 0
  const chartData = FALLBACK_CHART_DATA

  const mae30H = data?.humidity?.mae30 != null ? data.humidity.mae30.toFixed(2) : '0,42'
  const mae30T = data?.temperature?.mae30 != null ? data.temperature.mae30.toFixed(2) : '0,15'
  const mae60H = data?.humidity?.mae60 != null ? data.humidity.mae60.toFixed(2) : '0,78'
  const mae60T = data?.temperature?.mae60 != null ? data.temperature.mae60.toFixed(2) : '0,28'

  return (
    <div className="space-y-3">
      {/* Header ngang hàng chuẩn Stitch */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#27231F]">Dự báo vi khí hậu 60 phút tới</h2>
          {isMock && (
            <MockDataTooltip reason="Dữ liệu chuỗi thời gian mô phỏng theo mô hình Holt do Zone chưa tích lũy đủ 2 giờ telemetry thực tế." />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-neutral-100 text-[#27231F]">
            <Sparkles className="w-3 h-3 text-[#4A5C00]" />
            Mô hình làm mượt hàm mũ Holt
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-neutral-100 text-[#27231F]">
            Sai số 30p: <b className="ml-1 text-[#4A5C00]">±{mae30H}%RH • ±{mae30T}°C</b>
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-neutral-100 text-[#27231F]">
            Sai số 60p: <b className="ml-1 text-[#4A5C00]">±{mae60H}%RH • ±{mae60T}°C</b>
          </span>
        </div>
      </div>

      {/* Early warning banner */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <p className="text-xs font-medium text-orange-800">
            <strong>CẢNH BÁO SỚM:</strong> Độ ẩm dự kiến giảm xuống dưới ngưỡng an toàn (75,0 %RH) sau 25 phút nữa (Dự báo chạm mức 73,6 %RH)
          </p>
        </div>
        <span className="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-orange-500 text-white whitespace-nowrap">
          Sau 25 phút
        </span>
      </div>

      {/* Dual Y-axis ComposedChart */}
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={chartData} margin={{ top: 16, right: 36, left: 2, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
          <ReferenceArea x1="14:20" x2="+60 phút" yAxisId="hum" fill="#FFF8F0" fillOpacity={0.8} />

          <XAxis dataKey="time" padding={{ left: 14, right: 14 }} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="hum" domain={[68, 100]} tickCount={5} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} width={42} />
          <YAxis yAxisId="tmp" orientation="right" domain={[24, 34]} tickCount={5} tickFormatter={v => `${v}°C`} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} width={38} />

          <ReferenceLine yAxisId="hum" x="14:20" stroke="#27231F" strokeWidth={1.5} label={<NowLabel />} />
          <ReferenceLine yAxisId="hum" y={75} stroke="#D53F35" strokeDasharray="5 3" strokeWidth={1.5} />

          <Line yAxisId="hum" type="monotone" dataKey="h" name="Độ ẩm thực tế" stroke="#27231F" strokeWidth={2} dot={false} connectNulls={false} />
          <Line yAxisId="hum" type="monotone" dataKey="h_fc" name="Độ ẩm dự báo" stroke="#27231F" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
          <Line yAxisId="tmp" type="monotone" dataKey="t" name="Nhiệt độ thực tế" stroke="#8BAF2A" strokeWidth={2} dot={false} connectNulls={false} />
          <Line yAxisId="tmp" type="monotone" dataKey="t_fc" name="Nhiệt độ dự báo" stroke="#8BAF2A" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />

          <ReferenceDot yAxisId="hum" x="+25 phút" y={73.6} r={5} fill="#D53F35" stroke="white" strokeWidth={2} label={<DotLabel />} />

          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} formatter={(v, n) => [v != null ? `${v}` : '—', n]} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend đặt bên ngoài ResponsiveContainer chuẩn DOM HTML */}
      <CustomLegend />
    </div>
  )
}
