/**
 * DetectionColumn — Cột 3: Tham số phát hiện bất thường (Độc quyền Chuyên gia)
 * Hộp verdict_stats chuẩn Real Data + 6 stepper fields + reset trên header + save w-full
 * SRS v2.1.4: EXPERT-FR-003/008
 */
import { useState, useEffect } from 'react'
import { AlertTriangle, RotateCcw, Save, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import TuningStepperInput from './TuningStepperInput'
import type { ExpertDetectionTuning, ExpertVerdictStats } from '@/types/expert.types'

interface Props {
  data: ExpertDetectionTuning | undefined
  verdictStats: ExpertVerdictStats[]
  isLoading: boolean
  isSaving: boolean
  isResetting: boolean
  onSave: (v: Partial<ExpertDetectionTuning>) => void
  onReset: () => void
  updatedAt?: string
}

const TYPE_LABELS: Record<string, string> = {
  NOISE_ANOMALY: 'Ồn bất thường',
  MISTING_INEFFECTIVE: 'Phun sương không hiệu quả', // PUMP_DRY → MISTING_INEFFECTIVE (SRS 3.1.0)
  SENSOR_ANOMALY: 'Cảm biến bất thường',
  LOW_RETURN_RATE: 'Giảm tỉ lệ chim về',
}

function VerdictStatsHint({ stats }: { stats: ExpertVerdictStats[] }) {
  const totalVerdicts = stats.reduce((acc, s) => acc + s.confirmed + s.rejected, 0)

  if (totalVerdicts === 0) {
    return (
      <div className="mb-3 rounded-xl border border-stone-200/90 border-l-4 border-l-[#8BAF2A] bg-[#FAF9F5] px-3.5 py-2.5 shadow-2xs"
        title="Cơ chế tự động đối soát dựa trên phán quyết thẩm định cảnh báo (Feedback Loop)">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className="w-4 h-4 text-[#4A5C00] shrink-0" />
            <span className="font-bold text-xs text-[#27231F] whitespace-nowrap">Đối soát phán quyết</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-200/70 text-stone-700 whitespace-nowrap shrink-0">
            Mặc định (0/0)
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-600 leading-snug">
          Chưa có phán quyết trong kỳ. Đang duy trì tham số chuẩn an toàn.
        </p>
      </div>
    )
  }

  const worst = [...stats].filter(s => (s.confirmed + s.rejected) > 0 && s.rejected > 0)
    .sort((a, b) => (b.rejected / (b.confirmed + b.rejected)) - (a.rejected / (a.confirmed + a.rejected)))[0]

  if (!worst) {
    return (
      <div className="mb-3 rounded-xl border border-emerald-200/90 border-l-4 border-l-emerald-600 bg-emerald-50/60 px-3.5 py-2.5 shadow-2xs"
        title="Cơ chế tự động đối soát dựa trên phán quyết thẩm định cảnh báo (Feedback Loop)">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-xs text-emerald-900 whitespace-nowrap">Đối soát phán quyết</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap shrink-0">
            100% Chuẩn xác ({totalVerdicts}/{totalVerdicts})
          </span>
        </div>
        <p className="mt-1 text-xs text-emerald-800 leading-snug">
          Toàn bộ cảnh báo đều được xác nhận chuẩn. Tham số đang hoạt động tối ưu.
        </p>
      </div>
    )
  }

  const total = worst.confirmed + worst.rejected
  const rejPct = Math.round((worst.rejected / total) * 100)
  const label = TYPE_LABELS[worst.type] ?? worst.type
  const hint = worst.type === 'NOISE_ANOMALY' ? 'Tăng biên độ ồn (noise_margin_db).'
    : worst.type === 'MISTING_INEFFECTIVE' ? 'Tăng pump_dry_on_sec hoặc pump_dry_min_rise_pct.' // PUMP_DRY → MISTING_INEFFECTIVE
    : 'Điều chỉnh tham số phát hiện tương ứng.'

  return (
    <div className="mb-3 rounded-xl border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/80 px-3.5 py-2.5 shadow-2xs"
      title="Cơ chế tự động đối soát dựa trên phán quyết thẩm định cảnh báo (Feedback Loop)">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold text-xs text-amber-950 whitespace-nowrap">Khuyến nghị độ nhạy</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 whitespace-nowrap shrink-0">
          {rejPct}% Báo giả ({worst.rejected}/{total})
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-800 leading-snug">
        Cảnh báo <em>{label}</em> có tỷ lệ báo giả cao. Khuyến nghị: {hint}
      </p>
    </div>
  )
}

export default function DetectionColumn({
  data, verdictStats, isLoading, isSaving, isResetting, onSave, onReset, updatedAt,
}: Props) {
  const [form, setForm] = useState<ExpertDetectionTuning>({
    noise_margin_db: 15, noise_min_sec: 10, pump_dry_on_sec: 300,
    pump_dry_min_rise_pct: 2.0, speaker_drop_pct: 70, return_rate_drop_pct: 20,
  })

  useEffect(() => { if (data) setForm(data) }, [data])
  const set = (key: keyof ExpertDetectionTuning) => (v: number) => setForm(f => ({ ...f, [key]: v }))

  if (isLoading) return (
    <div className="bg-white rounded-[24px] border border-stone-200/80 shadow-sm p-5 animate-pulse space-y-3 h-full">
      <div className="h-14 bg-stone-100 rounded-xl" />
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-neutral-100 rounded-xl" />)}
    </div>
  )

  return (
    <div className="h-full flex flex-col justify-between bg-white rounded-[24px] p-5 border border-stone-200/80 shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#27231F]">3. Tham số phát hiện bất thường</h3>
            <span className="bg-[#27231F] text-[#ECFFA9] text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">Chuyên gia</span>
          </div>
          <p className="text-[11px] text-[#878380] mt-0.5">Cấu hình tham số nhận diện sự cố</p>
        </div>
        <button type="button" onClick={onReset} disabled={isResetting}
          className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-[#27231F] whitespace-nowrap shrink-0 transition-colors disabled:opacity-50">
          <RotateCcw className="w-3.5 h-3.5" />
          Khôi phục mặc định
        </button>
      </div>

      <div className="flex-1 py-1 divide-y divide-stone-100">
        <VerdictStatsHint stats={verdictStats} />
        <TuningStepperInput label="Biên độ ồn vượt nền P90" value={form.noise_margin_db ?? 15}
          onChange={set('noise_margin_db')} min={0} max={30} step={1} unit="dB" rangeHint="Phạm vi: 0–30 dB" defaultHint="Mặc định: 15 dB" />
        <TuningStepperInput label="Thời gian ồn kéo dài tối thiểu" value={form.noise_min_sec ?? 10}
          onChange={set('noise_min_sec')} min={5} max={120} step={1} unit="giây" rangeHint="Phạm vi: 5–120s" defaultHint="Mặc định: 10s" />
        <TuningStepperInput label="Thời gian bơm chạy không tăng ẩm" value={form.pump_dry_on_sec ?? 300}
          onChange={set('pump_dry_on_sec')} min={120} max={900} step={30} unit="giây" rangeHint="Phạm vi: 120–900s" defaultHint="Mặc định: 300s" />
        <TuningStepperInput label="Độ ẩm cần tăng tối thiểu" value={form.pump_dry_min_rise_pct ?? 2.0}
          onChange={set('pump_dry_min_rise_pct')} min={0.5} max={10} step={0.5} decimals={1} unit="%RH" rangeHint="Phạm vi: 0,5–10" defaultHint="Mặc định: 2 %RH" />
        <TuningStepperInput label="Độ sụt âm lượng báo hỏng loa" value={form.speaker_drop_pct ?? 70}
          onChange={set('speaker_drop_pct')} min={30} max={90} step={5} unit="%" rangeHint="Phạm vi: 30–90%" defaultHint="Mặc định: 70%" />
        <TuningStepperInput label="Ngưỡng sụt giảm tỉ lệ chim về" value={form.return_rate_drop_pct ?? 20}
          onChange={set('return_rate_drop_pct')} min={5} max={50} step={5} unit="%" rangeHint="Phạm vi: 5–50%" defaultHint="Mặc định: 20%" />
      </div>

      {updatedAt && (
        <p className="inline-flex items-center gap-1.5 pt-2 text-[11px] text-stone-500">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Cập nhật gần nhất: {updatedAt}
        </p>
      )}

      <div className="mt-auto pt-4 border-t border-stone-100">
        <button type="button" onClick={() => onSave(form)} disabled={isSaving}
          className={cn(
            'w-full py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all duration-150',
            isSaving ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-[#27231F] text-white hover:bg-[#3D3630] shadow-sm',
          )}>
          {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          <Save className="w-4 h-4" />
          Lưu tham số phát hiện
        </button>
      </div>
    </div>
  )
}
