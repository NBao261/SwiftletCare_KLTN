import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { LoadingSkeleton, SectionCard, Toggle } from '@/components/ui'
import InfoTip from '@/components/ui/InfoTip'
import { DEFAULT_FUZZY_TUNING } from '@/constants/thresholds'
import { t } from '@/i18n'
import { FUZZY_TUNING_LIMITS } from '@/validations/common/fuzzyTuning.validation'
import FuzzySuggestionBox, { type SuggestionAction } from '@/components/features/domain-expert/tuning/FuzzySuggestionBox'
import { TuningRangeList } from './TuningRangeTip'
import TuningStepperInput from './TuningStepperInput'
import type { TuningBlockHandle } from './tuning.utils'
import type { ExpertFuzzyTuning, FuzzySuggestionResponse } from '@/types/expert.types'

interface Props {
  data: ExpertFuzzyTuning | undefined
  isLoading: boolean
  isSaving: boolean
  onSave: (changed: Partial<ExpertFuzzyTuning>) => void
  suggestion?: FuzzySuggestionResponse
  isSuggestionLoading?: boolean
  suggestionAction?: SuggestionAction
  // Kỹ thuật viên không đọc gợi ý hệ số (backend 403) nên ẩn hẳn khung
  showSuggestion?: boolean
  // Báo số hệ số đang khác bản đã lưu lên thanh lưu dính đáy của trang
  onDirtyChange?: (count: number) => void
}

type NumericKey = Exclude<keyof ExpertFuzzyTuning, 'fuzzy_input_filter'>

// 4 hệ số số học của bộ điều khiển mờ; khoảng giá trị lấy từ luật dùng chung với backend
const ROWS: Array<{ key: NumericKey; label: string; step: number; decimals: number }> = [
  { key: 'fuzzy_humidity_band', label: 'Dải biên độ ẩm', step: 0.5, decimals: 1 },
  { key: 'fuzzy_temp_band', label: 'Dải biên nhiệt độ', step: 0.5, decimals: 1 },
  { key: 'fuzzy_fan_dry_level', label: 'Mức quạt khử ẩm', step: 5, decimals: 0 },
  { key: 'fuzzy_window_sec', label: 'Chu kỳ cửa sổ điều khiển', step: 10, decimals: 0 },
]

// Hệ số mờ của Zone và gợi ý từ dữ liệu; chỉ gửi hệ số đã đổi để lịch sử ghi đúng phần thay đổi
const FuzzyTuningColumn = forwardRef<TuningBlockHandle, Props>(function FuzzyTuningColumn(
  { data, isLoading, isSaving, onSave, suggestion, isSuggestionLoading = false, suggestionAction, showSuggestion = true, onDirtyChange }, ref,
) {
  const [form, setForm] = useState<ExpertFuzzyTuning>(DEFAULT_FUZZY_TUNING)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  const base = data ?? DEFAULT_FUZZY_TUNING
  // Số của Zone đang chọn chưa tải xong thì không có gì để lưu: lúc đó base là bộ mặc định, form có thể còn số của Zone trước
  const dirtyCount = !data ? 0 : ROWS.filter(row => form[row.key] !== base[row.key]).length
    + (form.fuzzy_input_filter !== base.fuzzy_input_filter ? 1 : 0)
  useEffect(() => { onDirtyChange?.(dirtyCount) }, [dirtyCount, onDirtyChange])

  function handleSave() {
    if (!data) return
    const changed: Partial<ExpertFuzzyTuning> = {}
    for (const row of ROWS) {
      if (form[row.key] !== base[row.key]) changed[row.key] = form[row.key]
    }
    if (form.fuzzy_input_filter !== base.fuzzy_input_filter) changed.fuzzy_input_filter = form.fuzzy_input_filter
    if (Object.keys(changed).length > 0) onSave(changed)
  }

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: () => setForm(base),
  }))

  if (isLoading) return <LoadingSkeleton count={5} className="h-12 w-full" />

  return (
    <SectionCard
      title={t('Hệ số điều khiển mờ')}
      description={t('Lưu xong, cấu hình gửi xuống bộ điều khiển của Zone')}
      help={<TuningRangeList hints={ROWS.map(row => ({
        label: t(row.label),
        range: `Phạm vi: ${FUZZY_TUNING_LIMITS[row.key].min}–${FUZZY_TUNING_LIMITS[row.key].max} ${t(FUZZY_TUNING_LIMITS[row.key].unit)}`,
        defaultValue: `Mặc định: ${DEFAULT_FUZZY_TUNING[row.key]}`,
      }))} />}
    >
      {showSuggestion && (
        <FuzzySuggestionBox
          suggestion={suggestion}
          isLoading={isSuggestionLoading}
          action={suggestionAction}
          onDismiss={() => setSuggestionDismissed(true)}
          dismissed={suggestionDismissed}
        />
      )}

      {/* Nút Lưu chung ở thanh dính đáy của trang */}
      <fieldset disabled={isSaving} className="divide-y divide-warmGray/10">
        {ROWS.map(row => (
          <TuningStepperInput
            key={row.key}
            label={t(row.label)}
            subLabel={t('Mặc định: {{value}}', { value: DEFAULT_FUZZY_TUNING[row.key] })}
            value={form[row.key]}
            onChange={value => setForm(previous => ({ ...previous, [row.key]: value }))}
            min={FUZZY_TUNING_LIMITS[row.key].min}
            max={FUZZY_TUNING_LIMITS[row.key].max}
            step={row.step}
            decimals={row.decimals}
            unit={t(FUZZY_TUNING_LIMITS[row.key].unit)}
          />
        ))}

        {/* Cờ lọc nhiễu đầu vào: cùng dạng hàng với các hệ số, giải thích đầy đủ trong nút (i) */}
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-medium text-charcoal">
              {t('Lọc nhiễu số đo')}
              <InfoTip>{t('Làm mượt nhiệt độ và độ ẩm trước khi đưa vào bộ điều khiển để rơ-le ít đóng cắt vì nhiễu. Tắt tạm để so sánh số lần đóng cắt mỗi giờ.')}</InfoTip>
            </p>
            <p className="mt-0.5 text-small italic text-warmGray">{t('Làm mượt số đo để rơ-le ít đóng cắt vì nhiễu')}</p>
          </div>
          <Toggle
            checked={form.fuzzy_input_filter}
            onChange={checked => setForm(previous => ({ ...previous, fuzzy_input_filter: checked }))}
            aria-label={t('Lọc nhiễu số đo')}
          />
        </div>
      </fieldset>
    </SectionCard>
  )
})

export default FuzzyTuningColumn
