/**
 * DetectionColumn — Cột 3: Tham số phát hiện bất thường (Độc quyền Chuyên gia)
 * Hộp verdict_stats chuẩn Real Data + 6 stepper fields + reset trên header + save w-full
 * SRS v2.1.4: EXPERT-FR-003/008
 */
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { AlertTriangle, RotateCcw, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { detectionTuningPayload, type TuningBlockHandle } from '@/components/features/domain-expert/tuning/tuning.utils'
import TuningStepperInput from './TuningStepperInput'
import type { ExpertDetectionTuning, ExpertVerdictStats } from '@/types/expert.types'
import { t, translated } from '@/i18n'

const FIELD_KEYS: Array<keyof ExpertDetectionTuning> = [
  'noise_margin_db', 'noise_min_sec', 'pump_dry_on_sec', 'pump_dry_min_rise_pct', 'speaker_drop_pct',
]

interface Props {
  data: ExpertDetectionTuning | undefined
  verdictStats: ExpertVerdictStats[]
  isLoading: boolean
  isSaving: boolean
  isResetting: boolean
  onSave: (v: Partial<ExpertDetectionTuning>) => void
  onReset: () => void
  updatedAt?: string
  // DE-04: báo số tham số đang khác bản đã lưu lên thanh lưu dính đáy của trang
  onDirtyChange?: (count: number) => void
}

const DEFAULT_DETECTION: ExpertDetectionTuning = {
  noise_margin_db: 15, noise_min_sec: 10, pump_dry_on_sec: 300,
  pump_dry_min_rise_pct: 2.0, speaker_drop_pct: 70,
}

const TYPE_LABELS: Record<string, string> = translated({
  NOISE_ANOMALY: 'Tiếng ồn bất thường',
  SENSOR_ANOMALY: 'Cảm biến bất thường',
  LOW_RETURN_RATE: 'Giảm tỷ lệ chim về',
})

function VerdictStatsHint({ stats }: { stats: ExpertVerdictStats[] }) {
  const totalVerdicts = stats.reduce((acc, s) => acc + s.confirmed + s.rejected, 0)

  if (totalVerdicts === 0) {
    return (
      <div className="mb-3 rounded-xl border border-stone-200/90 border-l-4 border-l-[#8BAF2A] bg-[#FAF9F5] px-3.5 py-2.5 shadow-2xs"
        title={t('Tỷ lệ kết luận đúng của loại cảnh báo này trong kỳ')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className="w-4 h-4 text-[#4A5C00] shrink-0" />
            <span className="font-bold text-xs text-[#27231F] whitespace-nowrap">{t('Kết luận trong kỳ')}</span>
          </div>
          <span className="text-small font-semibold px-2 py-0.5 rounded-full bg-stone-200/70 text-stone-700 whitespace-nowrap shrink-0">
            {t('Mặc định (0/0)')}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-600 leading-snug">
          {t('Chưa có kết luận nào trong kỳ.')}
        </p>
      </div>
    )
  }

  const worst = [...stats].filter(s => (s.confirmed + s.rejected) > 0 && s.rejected > 0)
    .sort((a, b) => (b.rejected / (b.confirmed + b.rejected)) - (a.rejected / (a.confirmed + a.rejected)))[0]

  if (!worst) {
    return (
      <div className="mb-3 rounded-xl border border-emerald-200/90 border-l-4 border-l-emerald-600 bg-emerald-50/60 px-3.5 py-2.5 shadow-2xs"
        title={t('Tỷ lệ kết luận đúng của loại cảnh báo này trong kỳ')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-xs text-emerald-900 whitespace-nowrap">{t('Kết luận trong kỳ')}</span>
          </div>
          <span className="text-small font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap shrink-0">
            {t('100% chuẩn xác ({{n}}/{{n}})', { n: totalVerdicts })}
          </span>
        </div>
        <p className="mt-1 text-xs text-emerald-800 leading-snug">
          {t('Mọi cảnh báo trong kỳ đều được xác nhận đúng.')}
        </p>
      </div>
    )
  }

  const total = worst.confirmed + worst.rejected
  const rejPct = Math.round((worst.rejected / total) * 100)
  const label = TYPE_LABELS[worst.type] ?? worst.type
  const hint = worst.type === 'NOISE_ANOMALY' ? t('Tăng biên độ ồn vượt nền.')
    : t('Điều chỉnh tham số phát hiện tương ứng.')

  return (
    <div className="mb-3 rounded-xl border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/80 px-3.5 py-2.5 shadow-2xs"
      title={t('Tỷ lệ kết luận đúng của loại cảnh báo này trong kỳ')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold text-xs text-amber-950 whitespace-nowrap">{t('Khuyến nghị độ nhạy')}</span>
        </div>
        <span className="text-small font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 whitespace-nowrap shrink-0">
          {t('{{pct}}% báo giả ({{n}}/{{total}})', { pct: rejPct, n: worst.rejected, total })}
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-800 leading-snug">
        {t('Cảnh báo {{type}} có tỷ lệ báo giả cao. Khuyến nghị: {{hint}}', { type: label, hint })}
      </p>
    </div>
  )
}

const DetectionColumn = forwardRef<TuningBlockHandle, Props>(function DetectionColumn(
  { data, verdictStats, isLoading, isSaving, isResetting, onSave, onReset, updatedAt, onDirtyChange }, ref,
) {
  const [form, setForm] = useState<ExpertDetectionTuning>(DEFAULT_DETECTION)

  useEffect(() => { if (data) setForm(data) }, [data])
  const set = (key: keyof ExpertDetectionTuning) => (v: number) => setForm(f => ({ ...f, [key]: v }))

  const base = data ?? DEFAULT_DETECTION
  const dirtyCount = FIELD_KEYS.filter(key => form[key] !== base[key]).length
  useEffect(() => { onDirtyChange?.(dirtyCount) }, [dirtyCount, onDirtyChange])

  useImperativeHandle(ref, () => ({
    save: () => onSave(detectionTuningPayload(form)),
    cancel: () => setForm(base),
  }))

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
            <h3 className="text-sm font-bold text-[#27231F]">{t('3. Tham số phát hiện bất thường')}</h3>
            <span className="bg-[#27231F] text-[#ECFFA9] text-small px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">{t('Chuyên gia')}</span>
          </div>
          <p className="text-small text-[#878380] mt-0.5">{t('Cấu hình tham số nhận diện sự cố')}</p>
        </div>
        <button type="button" onClick={onReset} disabled={isResetting}
          className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-[#27231F] whitespace-nowrap shrink-0 transition-colors disabled:opacity-50">
          <RotateCcw className="w-3.5 h-3.5" />
          {t('Khôi phục mặc định')}
        </button>
      </div>

      {/* Nút Lưu chung ở thanh dính đáy của trang (DE-04) */}
      <fieldset disabled={isSaving} className="flex-1 py-1 divide-y divide-stone-100">
        <VerdictStatsHint stats={verdictStats} />
        <TuningStepperInput label={t('Mức ồn vượt nền')} value={form.noise_margin_db ?? 15}
          onChange={set('noise_margin_db')} min={5} max={30} step={1} unit="dB" rangeHint="Phạm vi: 5–30 dB" defaultHint="Mặc định: 15 dB" />
        <TuningStepperInput label={t('Thời gian ồn kéo dài tối thiểu')} value={form.noise_min_sec ?? 10}
          onChange={set('noise_min_sec')} min={5} max={15} step={1} unit="giây" rangeHint="Phạm vi: 5–15s" defaultHint="Mặc định: 10s" />
        <TuningStepperInput label={t('Thời gian bơm chạy không tăng ẩm')} value={form.pump_dry_on_sec ?? 300}
          onChange={set('pump_dry_on_sec')} min={120} max={900} step={30} unit="giây" rangeHint="Phạm vi: 120–900s" defaultHint="Mặc định: 300s" />
        <TuningStepperInput label={t('Độ ẩm cần tăng tối thiểu')} value={form.pump_dry_min_rise_pct ?? 2.0}
          onChange={set('pump_dry_min_rise_pct')} min={0.5} max={10} step={0.5} decimals={1} unit="%RH" rangeHint="Phạm vi: 0,5–10" defaultHint="Mặc định: 2 %RH" />
        <TuningStepperInput label={t('Độ sụt âm lượng báo hỏng loa')} value={form.speaker_drop_pct ?? 70}
          onChange={set('speaker_drop_pct')} min={30} max={90} step={5} unit="%" rangeHint="Phạm vi: 30–90%" defaultHint="Mặc định: 70%" />
      </fieldset>

      {updatedAt && (
        <p className="mt-auto inline-flex items-center gap-1.5 pt-4 border-t border-stone-100 text-small text-stone-500">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {t('Cập nhật gần nhất: {{time}}', { time: updatedAt })}
        </p>
      )}
    </div>
  )
})

export default DetectionColumn
