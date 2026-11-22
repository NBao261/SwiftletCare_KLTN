import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { RotateCcw } from 'lucide-react'
import TuningStepperInput from '@/components/features/domain-expert/tuning/TuningStepperInput'
import TuningRangeTip from '@/components/features/domain-expert/tuning/TuningRangeTip'
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
  // DE-04: báo có đang khác bản đã lưu lên thanh lưu dính đáy của trang
  onDirtyChange?: (count: number) => void
}

// EXPERT-FR-008 — mức giảm tỷ lệ chim về là tham số của cả nhà yến (camera ở cửa nhà), đặt riêng với 5 tham số của Zone
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
    <div className="flex flex-col gap-3 bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
        <div>
          <h3 className="flex items-center gap-1 text-base font-bold text-charcoal">
            {t('4. Mức giảm tỷ lệ chim về của nhà')}
            {houseName && (
              <TuningRangeTip hints={[{ label: t('Ngưỡng sụt giảm tỷ lệ chim về'), range: 'Phạm vi: 5–50%', defaultValue: `Mặc định: ${DEFAULT_RETURN_RATE_DROP_PCT}%` }]} />
            )}
          </h3>
          <p className="text-small text-warmGray mt-0.5">
            {houseName ? t('Áp cho cả nhà "{{house}}": cảnh báo khi tỷ lệ chim về giảm', { house: houseName }) : t('Chọn một Zone để biết nhà cần chỉnh')}
          </p>
        </div>
        {houseName && (
          <button type="button" onClick={onReset} disabled={isResetting}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-stone-500 hover:bg-warmGray/10 hover:text-charcoal whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 max-sm:h-11">
            <RotateCcw className="w-3.5 h-3.5" />
            {t('Khôi phục mặc định')}
          </button>
        )}
      </div>

      {/* Nút Lưu chung ở thanh dính đáy của trang (DE-04) */}
      {houseName && (
        <fieldset disabled={isSaving} className="contents">
          <TuningStepperInput label={t('Ngưỡng sụt giảm tỷ lệ chim về')} value={draft}
            onChange={setDraft} min={5} max={50} step={5} unit="%" />
        </fieldset>
      )}
    </div>
  )
})

export default ReturnRateDropCard
