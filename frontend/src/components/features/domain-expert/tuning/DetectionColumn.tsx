// Cột tham số phát hiện bất thường
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { AlertTriangle, RotateCcw, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { detectionTuningPayload, type TuningBlockHandle } from '@/components/features/domain-expert/tuning/tuning.utils'
import TuningStepperInput from './TuningStepperInput'
import TuningRangeTip from './TuningRangeTip'
import type { ExpertDetectionTuning, ExpertVerdictStats } from '@/types/expert.types'
import { t, translated } from '@/i18n'

// 5 tham số phát hiện của Zone; khoảng và mặc định khớp backend detectionTuning.util.ts
const FIELDS: Array<{
  key: keyof ExpertDetectionTuning; label: string; min: number; max: number; step: number; decimals?: number
  unit: string; range: string; defaultHint: string
}> = [
  { key: 'noise_margin_db', label: 'Mức ồn vượt nền', min: 5, max: 30, step: 1, unit: 'dB', range: 'Phạm vi: 5–30 dB', defaultHint: 'Mặc định: 15 dB' },
  { key: 'noise_min_sec', label: 'Thời gian ồn kéo dài tối thiểu', min: 5, max: 15, step: 1, unit: 'giây', range: 'Phạm vi: 5–15s', defaultHint: 'Mặc định: 10s' },
  { key: 'pump_dry_on_sec', label: 'Thời gian bơm chạy không tăng ẩm', min: 120, max: 900, step: 30, unit: 'giây', range: 'Phạm vi: 120–900s', defaultHint: 'Mặc định: 300s' },
  { key: 'pump_dry_min_rise_pct', label: 'Độ ẩm cần tăng tối thiểu', min: 0.5, max: 10, step: 0.5, decimals: 1, unit: '%RH', range: 'Phạm vi: 0,5–10', defaultHint: 'Mặc định: 2 %RH' },
  { key: 'speaker_drop_pct', label: 'Độ sụt âm lượng báo hỏng loa', min: 30, max: 90, step: 5, unit: '%', range: 'Phạm vi: 30–90%', defaultHint: 'Mặc định: 70%' },
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
  // Báo số tham số đang khác bản đã lưu lên thanh lưu dính đáy của trang
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
  // Số của Zone đang chọn chưa tải xong thì không có gì để lưu: lúc đó base là bộ mặc định, form có thể còn số của Zone trước
  const dirtyCount = !data ? 0 : FIELDS.filter(field => form[field.key] !== base[field.key]).length
  useEffect(() => { onDirtyChange?.(dirtyCount) }, [dirtyCount, onDirtyChange])

  useImperativeHandle(ref, () => ({
    save: () => { if (data) onSave(detectionTuningPayload(form)) },
    cancel: () => setForm(base),
  }))

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5 animate-pulse space-y-3 h-full">
      <div className="h-14 bg-stone-100 rounded-xl" />
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-neutral-100 rounded-xl" />)}
    </div>
  )

  return (
    <div className="h-full flex flex-col justify-between bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="flex items-center gap-1 text-base font-bold text-charcoal">
              {t('3. Tham số phát hiện bất thường')}
              <TuningRangeTip hints={FIELDS.map(field => ({ label: t(field.label), range: field.range, defaultValue: field.defaultHint }))} />
            </h3>
            <span className="bg-charcoal text-limeMist text-small px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">{t('Chuyên gia')}</span>
          </div>
          <p className="text-small text-warmGray mt-0.5">{t('Cấu hình tham số nhận diện sự cố')}</p>
        </div>
        <button type="button" onClick={onReset} disabled={isResetting}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-stone-500 hover:bg-warmGray/10 hover:text-charcoal whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 max-sm:h-11">
          <RotateCcw className="w-3.5 h-3.5" />
          {t('Khôi phục mặc định')}
        </button>
      </div>

      {/* Nút Lưu chung ở thanh dính đáy của trang */}
      <fieldset disabled={isSaving} className="flex-1 py-1 divide-y divide-stone-100">
        <VerdictStatsHint stats={verdictStats} />
        {FIELDS.map(field => (
          <TuningStepperInput key={field.key} label={t(field.label)} value={form[field.key] ?? DEFAULT_DETECTION[field.key]}
            onChange={set(field.key)} min={field.min} max={field.max} step={field.step} decimals={field.decimals} unit={field.unit} />
        ))}
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
