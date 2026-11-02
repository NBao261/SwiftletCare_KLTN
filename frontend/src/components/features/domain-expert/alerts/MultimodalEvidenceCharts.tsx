/**
 * MultimodalEvidenceCharts — Bằng chứng đối chiếu đa phương thức (Bước 1 Drawer 02B)
 * Render động theo loại cảnh báo và thời điểm xảy ra với Recharts chuẩn toán học
 * SRS v2.1.4: EXPERT-FR-003
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Cell, ResponsiveContainer,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import type { InferredAlertItem } from '@/types/expert.types'
import { buildAlertEvidence, type EvidenceSource } from './alertEvidence'

interface Props { alert: InferredAlertItem }

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string; unit: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 shadow-lg text-xs">
      <p className="font-semibold text-[#27231F]">{label}</p>
      <p className="text-[#878380]">Giá trị: <b className="text-[#27231F]">{payload[0].value}{unit}</b></p>
    </div>
  )
}

function EvidenceBarCard({ src, dotColor }: { src: EvidenceSource; dotColor: string }) {
  return (
    <div className="bg-neutral-50 rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
          <span className="text-xs font-semibold text-[#27231F] whitespace-nowrap">{src.title}</span>
          <MockDataTooltip reason="Dữ liệu chuỗi thời gian 5 phút được mô phỏng từ telemetry cảm biến và AI đối chứng." />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#878380] shrink-0">
          <span>{src.badge1}</span>
          <span className="text-neutral-300">|</span>
          <span>{src.badge2}</span>
          {src.highlight && (
            <>
              <span className="text-neutral-300">|</span>
              <span className="text-red-600 font-semibold">{src.highlight}</span>
            </>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={src.data} barCategoryGap="25%" margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} interval={2} />
          <YAxis
            domain={src.domain}
            ticks={src.ticks}
            interval={0}
            tick={{ fontSize: 10, fill: '#878380' }}
            axisLine={false}
            tickLine={false}
            unit={src.unit}
          />
          <Tooltip content={<ChartTooltip unit={src.unit} />} />
          <ReferenceLine y={src.refY} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: src.refLabel, position: 'insideTopRight', fontSize: 9, fill: '#B45309' }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {src.data.map((entry, i) => (
              <Cell key={i} fill={entry.isAnomaly ? '#D53F35' : (src.barColor ?? '#D4D0CB')} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-center mt-1">
        <span className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded px-2 py-0.5">
          {src.anomalyTag}
        </span>
      </div>
    </div>
  )
}

export default function MultimodalEvidenceCharts({ alert }: Props) {
  const cfg = buildAlertEvidence(alert)

  return (
    <div className="space-y-3">
      <EvidenceBarCard src={cfg.src1} dotColor="bg-[#27231F]" />
      <EvidenceBarCard src={cfg.src2} dotColor="bg-[#B5D32C]" />

      {/* Hộp tương quan / chẩn đoán */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex gap-3">
        <span className="mt-0.5 flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </span>
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Chẩn đoán nguyên nhân:</strong> {cfg.correlation}
        </p>
      </div>
    </div>
  )
}
