import { useEffect, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { cn } from '@/lib/cn'
import TuningStepperInput from '@/components/features/domain-expert/tuning/TuningStepperInput'
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
}

// EXPERT-FR-008 — mức giảm tỷ lệ chim về là tham số của cả nhà yến (camera ở cửa nhà), đặt riêng với 5 tham số của Zone
export default function ReturnRateDropCard({ houseName, value, isSaving, isResetting, onSave, onReset }: Props) {
  const [draft, setDraft] = useState(value ?? DEFAULT_RETURN_RATE_DROP_PCT)
  useEffect(() => { setDraft(value ?? DEFAULT_RETURN_RATE_DROP_PCT) }, [value])

  return (
    <div className="flex flex-col gap-3 bg-white rounded-[24px] p-5 border border-stone-200/80 shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div>
          <h3 className="text-sm font-bold text-[#27231F]">{t('4. Mức giảm tỷ lệ chim về của nhà')}</h3>
          <p className="text-[11px] text-[#878380] mt-0.5">
            {houseName ? t('Áp cho cả nhà "{{house}}": cảnh báo khi tỷ lệ chim về giảm', { house: houseName }) : t('Chọn một Zone để biết nhà cần chỉnh')}
          </p>
        </div>
        {houseName && (
          <button type="button" onClick={onReset} disabled={isResetting}
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-[#27231F] whitespace-nowrap shrink-0 transition-colors disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" />
            {t('Khôi phục mặc định')}
          </button>
        )}
      </div>

      {houseName && (
        <>
          <TuningStepperInput label={t('Ngưỡng sụt giảm tỷ lệ chim về')} value={draft}
            onChange={setDraft} min={5} max={50} step={5} unit="%" rangeHint="Phạm vi: 5–50%" defaultHint={`Mặc định: ${DEFAULT_RETURN_RATE_DROP_PCT}%`} />
          <button type="button" onClick={() => onSave(draft)} disabled={isSaving}
            className={cn(
              'w-full py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all duration-150',
              isSaving ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-[#27231F] text-white hover:bg-[#3D3630] shadow-sm',
            )}>
            {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <Save className="w-4 h-4" />
            {t('Lưu mức giảm của nhà')}
          </button>
        </>
      )}
    </div>
  )
}
