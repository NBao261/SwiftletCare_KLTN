import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { RotateCcw } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import TuningStepperInput from './TuningStepperInput'
import type { TuningBlockHandle } from './tuning.utils'
import type { ExpertThresholds } from '@/types/expert.types'
import { t } from '@/i18n'
import { FACTORY_DEFAULT_THRESHOLDS } from '@/constants/thresholds'
import { THRESHOLD_LIMITS, validateThresholds } from '@/validations/common/threshold.validation'

interface Props {
  data: ExpertThresholds | undefined
  isLoading: boolean
  isSaving: boolean
  isResetting: boolean
  onSave: (v: Partial<ExpertThresholds>) => void
  onReset: () => void
  // DE-04: báo số ngưỡng đang khác bản đã lưu lên thanh lưu dính đáy của trang
  onDirtyChange?: (count: number) => void
}

// 7 ngưỡng của Zone (ENV-FR-006); khoảng giá trị là khoảng đo cảm biến của backend (THRESHOLD_LIMITS), không tự chọn
const FIELDS: Array<{ key: keyof ExpertThresholds; label: string; subLabel?: string; step: number; decimals: number }> = [
  { key: 'temp_min', label: 'Nhiệt độ tối thiểu', step: 0.5, decimals: 1 },
  { key: 'temp_max', label: 'Nhiệt độ tối đa', step: 0.5, decimals: 1 },
  { key: 'humidity_min', label: 'Độ ẩm tối thiểu', step: 0.5, decimals: 1 },
  { key: 'humidity_max', label: 'Độ ẩm tối đa', step: 0.5, decimals: 1 },
  { key: 'light_max', label: 'Ánh sáng tối đa', subLabel: 'Chuẩn tối yến tổ', step: 0.1, decimals: 1 },
  { key: 'nh3_max', label: 'Ngưỡng cảnh báo khí NH3', subLabel: 'Chỉ cảnh báo', step: 1, decimals: 0 },
  { key: 'co2_max', label: 'Ngưỡng cảnh báo khí CO2', subLabel: 'Chỉ cảnh báo', step: 50, decimals: 0 },
]

// Ngưỡng vi khí hậu và khí độc của Zone: kiểm cùng luật với backend trước khi lưu, khôi phục về mặc định của hệ thống (ENV-FR-020)
const ThresholdColumn = forwardRef<TuningBlockHandle, Props>(function ThresholdColumn(
  { data, isLoading, isSaving, isResetting, onSave, onReset, onDirtyChange }, ref,
) {
  const [form, setForm] = useState<ExpertThresholds>(FACTORY_DEFAULT_THRESHOLDS)
  const [resetOpen, setResetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (data) setForm(data) }, [data])

  const base = data ?? FACTORY_DEFAULT_THRESHOLDS
  const dirtyCount = FIELDS.filter(field => form[field.key] !== base[field.key]).length
  useEffect(() => { onDirtyChange?.(dirtyCount) }, [dirtyCount, onDirtyChange])

  const set = (key: keyof ExpertThresholds) => (v: number) => {
    setForm(f => ({ ...f, [key]: v }))
    setError(null)
  }

  const handleSave = () => {
    const firstError = Object.values(validateThresholds(form))[0]
    if (firstError) { setError(t(firstError)); return }
    setError(null)
    onSave(form)
  }

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: () => { setForm(base); setError(null) },
  }))

  if (isLoading) return (
    <div className="bg-white rounded-[24px] border border-stone-200/80 shadow-sm p-5 animate-pulse space-y-4 h-full">
      {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-12 bg-neutral-100 rounded-xl" />)}
    </div>
  )

  return (
    <>
      <div className="h-full flex flex-col justify-between bg-white rounded-[24px] p-5 border border-stone-200/80 shadow-2xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-bold text-charcoal">{t('2. Ngưỡng vi khí hậu & khí độc')}</h3>
            <p className="text-small text-warmGray mt-0.5">{t('Tiêu chuẩn vi khí hậu môi trường nuôi')}</p>
          </div>
          <button type="button" onClick={() => setResetOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-charcoal whitespace-nowrap shrink-0 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            {t('Khôi phục mặc định')}
          </button>
        </div>

        {/* Fields */}
        <fieldset disabled={isSaving} className="flex-1 py-1 divide-y divide-stone-100">
          {FIELDS.map(field => {
            const limit = THRESHOLD_LIMITS[field.key]
            return (
              <TuningStepperInput key={field.key} label={t(field.label)} subLabel={field.subLabel} value={form[field.key]} onChange={set(field.key)}
                min={limit.min} max={limit.max} step={field.step} decimals={field.decimals} unit={limit.unit}
                rangeHint={`Phạm vi: ${limit.min}–${limit.max} ${limit.unit}`} />
            )
          })}
        </fieldset>

        {/* Lỗi kiểm ngưỡng; nút Lưu chung ở thanh dính đáy của trang (DE-04) */}
        {error && <p className="mt-auto pt-4 border-t border-stone-100 text-xs text-red-600">{error}</p>}
      </div>

      <ConfirmModal
        open={resetOpen}
        title={t('Khôi phục ngưỡng mặc định?')}
        description={t('Thao tác sẽ ghi đè toàn bộ ngưỡng hiện tại của Zone bằng ngưỡng mặc định hiện hành do Quản trị viên đặt. Không thể hoàn tác.')}
        confirmLabel={t('Xác nhận khôi phục')}
        danger
        loading={isResetting}
        onConfirm={() => { onReset(); setResetOpen(false) }}
        onCancel={() => setResetOpen(false)}
      />
    </>
  )
})

export default ThresholdColumn
