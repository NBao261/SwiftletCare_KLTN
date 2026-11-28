// Cột tham số phát hiện bất thường
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { Badge, Button, LoadingSkeleton, SectionCard } from '@/components/ui'
import { detectionTuningPayload, type TuningBlockHandle } from '@/components/features/domain-expert/tuning/tuning.utils'
import TuningStepperInput from './TuningStepperInput'
import { TuningRangeList } from './TuningRangeTip'
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
  // Trả về true khi khôi phục được: ô đang sửa dở cũng về mặc định theo
  onReset: () => Promise<boolean> | undefined
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
  LOW_RETURN_RATE: 'Tỷ lệ chim về thấp',
})

// Ghi chú một dòng về kết luận của chuyên gia trong kỳ: chưa có, toàn đúng, hay loại báo giả nhiều nhất
function VerdictStatsHint({ stats }: { stats: ExpertVerdictStats[] }) {
  const totalVerdicts = stats.reduce((acc, s) => acc + s.confirmed + s.rejected, 0)
  const title = t('Tỷ lệ kết luận đúng của loại cảnh báo này trong kỳ')

  if (totalVerdicts === 0) {
    return <p title={title} className="rounded-xl bg-warmGray/10 px-3 py-2 text-small text-graphite">{t('Chưa có cảnh báo nào được kết luận trong kỳ, chưa đủ để đánh giá các tham số này.')}</p>
  }

  const worst = [...stats].filter(s => (s.confirmed + s.rejected) > 0 && s.rejected > 0)
    .sort((a, b) => (b.rejected / (b.confirmed + b.rejected)) - (a.rejected / (a.confirmed + a.rejected)))[0]

  if (!worst) {
    return (
      <p title={title} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-50 px-3 py-2 text-small text-graphite">
        <span>{t('Mọi cảnh báo trong kỳ đều được xác nhận đúng.')}</span>
        <Badge tone="positive">{t('100% chuẩn xác ({{n}}/{{n}})', { n: totalVerdicts })}</Badge>
      </p>
    )
  }

  const total = worst.confirmed + worst.rejected
  const rejPct = Math.round((worst.rejected / total) * 100)
  const label = TYPE_LABELS[worst.type] ?? worst.type
  const hint = worst.type === 'NOISE_ANOMALY' ? t('Tăng mức ồn vượt nền.') : t('Điều chỉnh tham số phát hiện tương ứng.')

  return (
    <div title={title} className="flex flex-col gap-1 rounded-xl bg-climateOrange/10 px-3 py-2 text-small text-graphite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-charcoal">{t('Khuyến nghị độ nhạy')}</span>
        <Badge tone="warning">{t('{{pct}} % báo động giả ({{n}}/{{total}})', { pct: rejPct, n: worst.rejected, total })}</Badge>
      </div>
      <span>{t('Cảnh báo {{type}} có tỷ lệ báo động giả cao. Khuyến nghị: {{hint}}', { type: label, hint })}</span>
    </div>
  )
}

const DetectionColumn = forwardRef<TuningBlockHandle, Props>(function DetectionColumn(
  { data, verdictStats, isLoading, isSaving, isResetting, onSave, onReset, updatedAt, onDirtyChange }, ref,
) {
  const [form, setForm] = useState<ExpertDetectionTuning>(DEFAULT_DETECTION)

  // Khôi phục mặc định xong thì ô đang sửa dở về đúng số đang áp dụng, kể cả khi số đang áp dụng không đổi (đã là mặc định)
  const [resetCount, setResetCount] = useState(0)
  useEffect(() => { if (data) setForm(data) }, [data, resetCount])
  const handleReset = () => {
    void onReset()?.then(succeeded => { if (succeeded) setResetCount(count => count + 1) })
  }
  const set = (key: keyof ExpertDetectionTuning) => (v: number) => setForm(f => ({ ...f, [key]: v }))

  const base = data ?? DEFAULT_DETECTION
  // Số của Zone đang chọn chưa tải xong thì không có gì để lưu: lúc đó base là bộ mặc định, form có thể còn số của Zone trước
  const dirtyCount = !data ? 0 : FIELDS.filter(field => form[field.key] !== base[field.key]).length
  useEffect(() => { onDirtyChange?.(dirtyCount) }, [dirtyCount, onDirtyChange])

  useImperativeHandle(ref, () => ({
    save: () => { if (data) onSave(detectionTuningPayload(form)) },
    cancel: () => setForm(base),
  }))

  if (isLoading) return <LoadingSkeleton count={6} className="h-12 w-full" />

  return (
    <SectionCard
      title={t('Tham số phát hiện')}
      description={t('Ngưỡng để hệ thống nhận ra sự cố thiết bị và tiếng ồn')}
      help={<TuningRangeList hints={FIELDS.map(field => ({ label: t(field.label), range: field.range, defaultValue: field.defaultHint }))} />}
      action={(
        <Button variant="icon" size="sm" onClick={handleReset} disabled={isResetting} aria-label={t('Khôi phục mặc định')} title={t('Khôi phục mặc định')}>
            <ArrowCounterClockwiseIcon size={16} weight="bold" />
          </Button>
      )}
    >
      <VerdictStatsHint stats={verdictStats} />

      {/* Nút Lưu chung ở thanh dính đáy của trang */}
      <fieldset disabled={isSaving} className="divide-y divide-warmGray/10">
        {FIELDS.map(field => (
          <TuningStepperInput key={field.key} label={t(field.label)} value={form[field.key] ?? DEFAULT_DETECTION[field.key]}
            onChange={set(field.key)} min={field.min} max={field.max} step={field.step} decimals={field.decimals} unit={field.unit} />
        ))}
      </fieldset>

      {updatedAt && <p className="text-small text-warmGray">{t('Cập nhật gần nhất: {{time}}', { time: updatedAt })}</p>}
    </SectionCard>
  )
})

export default DetectionColumn
