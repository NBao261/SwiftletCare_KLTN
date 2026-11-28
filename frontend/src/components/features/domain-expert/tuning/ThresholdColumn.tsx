import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Button, LoadingSkeleton, SectionCard } from '@/components/ui'
import TuningStepperInput from './TuningStepperInput'
import { TuningRangeList } from './TuningRangeTip'
import type { TuningBlockHandle } from './tuning.utils'
import type { ExpertThresholds } from '@/types/expert.types'
import { t } from '@/i18n'
import { FACTORY_DEFAULT_THRESHOLDS } from '@/constants/thresholds'
import { THRESHOLD_LIMITS, validateThresholds } from '@/validations/common/threshold.validation'
import FieldError from '@/components/ui/FieldError'

interface Props {
  data: ExpertThresholds | undefined
  isLoading: boolean
  isSaving: boolean
  isResetting: boolean
  onSave: (v: Partial<ExpertThresholds>) => void
  onReset: () => void
  // Báo số ngưỡng đang khác bản đã lưu lên thanh lưu dính đáy của trang
  onDirtyChange?: (count: number) => void
}

// 7 ngưỡng của Zone; khoảng giá trị là khoảng đo cảm biến của backend (THRESHOLD_LIMITS), không tự chọn
const FIELDS: Array<{ key: keyof ExpertThresholds; label: string; subLabel?: string; step: number; decimals: number }> = [
  { key: 'temp_min', label: 'Nhiệt độ tối thiểu', step: 0.5, decimals: 1 },
  { key: 'temp_max', label: 'Nhiệt độ tối đa', step: 0.5, decimals: 1 },
  { key: 'humidity_min', label: 'Độ ẩm tối thiểu', step: 0.5, decimals: 1 },
  { key: 'humidity_max', label: 'Độ ẩm tối đa', step: 0.5, decimals: 1 },
  { key: 'light_max', label: 'Ánh sáng tối đa', subLabel: 'Yến cần tối để làm tổ', step: 0.1, decimals: 1 },
  { key: 'nh3_max', label: 'Ngưỡng cảnh báo khí NH3', subLabel: 'Chỉ cảnh báo', step: 1, decimals: 0 },
  { key: 'co2_max', label: 'Ngưỡng cảnh báo khí CO2', subLabel: 'Chỉ cảnh báo', step: 50, decimals: 0 },
]

// Ngưỡng vi khí hậu và khí độc của Zone: kiểm cùng luật với backend trước khi lưu, khôi phục về mặc định của hệ thống
const ThresholdColumn = forwardRef<TuningBlockHandle, Props>(function ThresholdColumn(
  { data, isLoading, isSaving, isResetting, onSave, onReset, onDirtyChange }, ref,
) {
  const [form, setForm] = useState<ExpertThresholds>(FACTORY_DEFAULT_THRESHOLDS)
  const [resetOpen, setResetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (data) setForm(data) }, [data])

  const base = data ?? FACTORY_DEFAULT_THRESHOLDS
  // Số của Zone đang chọn chưa tải xong thì không có gì để lưu: lúc đó base là bộ mặc định, form có thể còn số của Zone trước
  const dirtyCount = !data ? 0 : FIELDS.filter(field => form[field.key] !== base[field.key]).length
  useEffect(() => { onDirtyChange?.(dirtyCount) }, [dirtyCount, onDirtyChange])

  const set = (key: keyof ExpertThresholds) => (v: number) => {
    setForm(f => ({ ...f, [key]: v }))
    setError(null)
  }

  const handleSave = () => {
    if (!data) return
    const firstError = Object.values(validateThresholds(form))[0]
    if (firstError) { setError(t(firstError)); return }
    setError(null)
    onSave(form)
  }

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: () => { setForm(base); setError(null) },
  }))

  if (isLoading) return <LoadingSkeleton count={7} className="h-12 w-full" />

  return (
    <>
      <SectionCard
        title={t('Ngưỡng môi trường')}
        description={t('Tiêu chuẩn vi khí hậu trong nhà yến')}
        help={<TuningRangeList hints={FIELDS.map(field => {
          const limit = THRESHOLD_LIMITS[field.key]
          return { label: t(field.label), range: `Phạm vi: ${limit.min}–${limit.max} ${t(limit.unit)}` }
        })} />}
        action={(
          <Button variant="icon" size="sm" onClick={() => setResetOpen(true)} aria-label={t('Khôi phục mặc định')} title={t('Khôi phục mặc định')}>
            <ArrowCounterClockwiseIcon size={16} weight="bold" />
          </Button>
        )}
      >
        <fieldset disabled={isSaving} className="divide-y divide-warmGray/10">
          {FIELDS.map(field => {
            const limit = THRESHOLD_LIMITS[field.key]
            return (
              <TuningStepperInput key={field.key} label={t(field.label)} subLabel={field.subLabel} value={form[field.key]} onChange={set(field.key)}
                min={limit.min} max={limit.max} step={field.step} decimals={field.decimals} unit={limit.unit} />
            )
          })}
        </fieldset>

        {/* Lỗi kiểm ngưỡng; nút Lưu chung ở thanh dính đáy của trang */}
        {error && <FieldError>{error}</FieldError>}
      </SectionCard>

      <ConfirmModal
        open={resetOpen}
        title={t('Khôi phục ngưỡng mặc định?')}
        description={t('Ngưỡng của Zone sẽ về mặc định hệ thống do Quản trị viên đặt. Không hoàn tác được.')}
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
