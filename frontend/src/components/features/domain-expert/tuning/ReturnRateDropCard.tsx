import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { Button, SectionCard } from '@/components/ui'
import TuningStepperInput from '@/components/features/domain-expert/tuning/TuningStepperInput'
import { TuningRangeList } from '@/components/features/domain-expert/tuning/TuningRangeTip'
import type { TuningBlockHandle } from '@/components/features/domain-expert/tuning/tuning.utils'
import { t } from '@/i18n'

// Mặc định và khoảng khớp backend `detectionTuning.util.ts` (BIRD_COUNT_TUNING_LIMITS)
const DEFAULT_RETURN_RATE_DROP_PCT = 20

interface Props {
  houseName?: string
  value?: number
  isSaving: boolean
  isResetting: boolean
  onSave: (returnRateDropPct: number) => void
  onReset: () => void
  // Báo có đang khác bản đã lưu lên thanh lưu dính đáy của trang
  onDirtyChange?: (count: number) => void
}

// mức giảm tỷ lệ chim về là tham số của cả nhà yến (camera ở cửa nhà), đặt riêng với 5 tham số của Zone
const ReturnRateDropCard = forwardRef<TuningBlockHandle, Props>(function ReturnRateDropCard(
  { houseName, value, isSaving, isResetting, onSave, onReset, onDirtyChange }, ref,
) {
  const base = value ?? DEFAULT_RETURN_RATE_DROP_PCT
  const [draft, setDraft] = useState(base)
  useEffect(() => { setDraft(base) }, [base])

  const dirtyCount = houseName && draft !== base ? 1 : 0
  useEffect(() => { onDirtyChange?.(dirtyCount) }, [dirtyCount, onDirtyChange])

  useImperativeHandle(ref, () => ({
    save: () => onSave(draft),
    cancel: () => setDraft(base),
  }))

  return (
    <SectionCard
      title={t('Mức giảm tỷ lệ chim về của nhà')}
      description={houseName ? t('Áp cho cả nhà "{{house}}": cảnh báo khi tỷ lệ chim về giảm', { house: houseName }) : t('Chọn một Zone để biết nhà cần chỉnh')}
      help={houseName
        ? <TuningRangeList hints={[{ label: t('Ngưỡng sụt giảm tỷ lệ chim về'), range: 'Phạm vi: 5–50%', defaultValue: `Mặc định: ${DEFAULT_RETURN_RATE_DROP_PCT}%` }]} />
        : undefined}
      action={houseName && (
        <Button variant="icon" size="sm" onClick={onReset} disabled={isResetting} aria-label={t('Khôi phục mặc định')} title={t('Khôi phục mặc định')}>
            <ArrowCounterClockwiseIcon size={16} weight="bold" />
          </Button>
      )}
    >
      {/* Nút Lưu chung ở thanh dính đáy của trang */}
      {houseName && (
        <fieldset disabled={isSaving} className="contents">
          <TuningStepperInput label={t('Ngưỡng sụt giảm tỷ lệ chim về')} value={draft}
            onChange={setDraft} min={5} max={50} step={5} unit="%" />
        </fieldset>
      )}
    </SectionCard>
  )
})

export default ReturnRateDropCard
