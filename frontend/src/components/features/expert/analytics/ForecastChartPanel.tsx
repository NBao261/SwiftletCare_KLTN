/**
 * ForecastChartPanel — Biểu đồ Dự báo vi khí hậu 60 phút (Khối 1 màn hình 04)
 * ComposedChart dual Y-axis: %RH trái | °C phải
 * SRS v2.1.4: ANALYTICS-FR-008
 */
import { useMemo } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { ForecastResponse } from '@/types/expert.types'

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
  const chartData = useMemo(() => {
    if (!data) return []
    const points: Array<{ time: string; h: number | null; t: number | null; h_fc: number | null; t_fc: number | null }> = []
    const hHist = data.humidity?.history ?? []
    const tHist = data.temperature?.history ?? []
    const hFc = data.humidity?.forecast ?? []
    const tFc = data.temperature?.forecast ?? []

    const formatTime = (ts: string) => {
      const dt = new Date(ts)
      return `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`
    }

    hHist.forEach((item, idx) => {
      points.push({
        time: formatTime(item.timestamp),
        h: item.value,
        t: tHist[idx]?.value ?? null,
        h_fc: null,
        t_fc: null,
      })
    })

    hFc.forEach((item, idx) => {
      points.push({
        time: `+${(idx + 1) * (data.bucketMinutes || 15)}p`,
        h: null,
        t: null,
        h_fc: item.value,
        t_fc: tFc[idx]?.value ?? null,
      })
    })

    return points
  }, [data])

  if (isLoading) return <div className="h-[280px] bg-neutral-50 rounded-xl animate-pulse" />

  const history = data?.humidity?.history ?? []
  const forecast = data?.humidity?.forecast ?? []
  const hasData = history.length > 0 || forecast.length > 0

  if (!data || !hasData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 text-center space-y-2">
        <Sparkles className="w-6 h-6 text-[#8BAF2A]" />
        <h3 className="text-sm font-bold text-[#27231F]">Chưa có dữ liệu dự báo vi khí hậu</h3>
        <p className="text-xs text-[#878380] max-w-md">
          Hệ thống cần tối thiểu 2 giờ dữ liệu telemetry liên tục để mô hình làm mượt hàm mũ Holt tính toán dự báo 60 phút tới.
        </p>
      </div>
    )
  }

  const mae30H = data?.humidity?.mae30 != null ? data.humidity.mae30.toFixed(2) : '—'
  const mae30T = data?.temperature?.mae30 != null ? data.temperature.mae30.toFixed(2) : '—'
  const mae60H = data?.humidity?.mae60 != null ? data.humidity.mae60.toFixed(2) : '—'
  const mae60T = data?.temperature?.mae60 != null ? data.temperature.mae60.toFixed(2) : '—'

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-base font-bold text-[#27231F]">Dự báo vi khí hậu 60 phút tới</h2>
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
      {data.predicted && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <p className="text-xs font-medium text-orange-800">
              <strong>CẢNH BÁO SỚM:</strong> {data.predicted.metric === 'humidity' ? 'Độ ẩm' : 'Nhiệt độ'} dự kiến {data.predicted.direction === 'below' ? 'giảm xuống dưới' : 'vượt quá'} ngưỡng an toàn ({data.predicted.limit}) sau {data.predicted.minutesAhead} phút nữa (Dự báo: {data.predicted.value})
            </p>
          </div>
          <span className="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-orange-500 text-white whitespace-nowrap">
            Sau {data.predicted.minutesAhead} phút
          </span>
        </div>
      )}

      {/* Dual Y-axis ComposedChart */}
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={chartData} margin={{ top: 16, right: 36, left: 2, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
          <XAxis dataKey="time" padding={{ left: 14, right: 14 }} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="hum" domain={[68, 100]} tickCount={5} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} width={42} />
          <YAxis yAxisId="tmp" orientation="right" domain={[24, 34]} tickCount={5} tickFormatter={v => `${v}°C`} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} width={38} />
          <ReferenceLine yAxisId="hum" y={75} stroke="#D53F35" strokeDasharray="5 3" strokeWidth={1.5} />
          <Line yAxisId="hum" type="monotone" dataKey="h" name="Độ ẩm thực tế" stroke="#27231F" strokeWidth={2} dot={false} connectNulls={false} />
          <Line yAxisId="hum" type="monotone" dataKey="h_fc" name="Độ ẩm dự báo" stroke="#27231F" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
          <Line yAxisId="tmp" type="monotone" dataKey="t" name="Nhiệt độ thực tế" stroke="#8BAF2A" strokeWidth={2} dot={false} connectNulls={false} />
          <Line yAxisId="tmp" type="monotone" dataKey="t_fc" name="Nhiệt độ dự báo" stroke="#8BAF2A" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} formatter={(v, n) => [v != null ? `${v}` : '—', n]} />
        </ComposedChart>
      </ResponsiveContainer>

      <CustomLegend />
    </div>
  )
}
