import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Toggle } from '@/components/ui'
import InfoTip from '@/components/ui/InfoTip'
import { DEFAULT_FUZZY_TUNING } from '@/constants/thresholds'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { FUZZY_TUNING_LIMITS } from '@/validations/common/fuzzyTuning.validation'
import FuzzySuggestionBox, { type SuggestionAction } from '@/components/features/domain-expert/tuning/FuzzySuggestionBox'
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
  // DE-04: báo số hệ số đang khác bản đã lưu lên thanh lưu dính đáy của trang
  onDirtyChange?: (count: number) => void
}

type NumericKey = Exclude<keyof ExpertFuzzyTuning, 'fuzzy_input_filter'>

// 4 hệ số số học của bộ điều khiển mờ; khoảng giá trị lấy từ luật dùng chung với backend
const TILES: Array<{ key: NumericKey; label: string; step: number; decimals: number }> = [
  { key: 'fuzzy_humidity_band', label: 'Dải biên độ ẩm', step: 0.5, decimals: 1 },
  { key: 'fuzzy_temp_band', label: 'Dải biên nhiệt độ', step: 0.5, decimals: 1 },
  { key: 'fuzzy_fan_dry_level', label: 'Mức quạt khử ẩm', step: 5, decimals: 0 },
  { key: 'fuzzy_window_sec', label: 'Chu kỳ cửa sổ điều khiển', step: 10, decimals: 0 },
]

function FuzzyTile({ label, value, onChange, min, max, step, decimals, unit, defaultValue }: {
  label: string; value: number; onChange: (value: number) => void
  min: number; max: number; step: number; decimals: number; unit: string; defaultValue: number
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next * 10 ** decimals) / 10 ** decimals))
  const atMin = value <= min
  const atMax = value >= max

  return (
    <div className="rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 shadow-2xs bg-gray-50/60 border-stone-200/70 hover:border-stone-300">
      <div>
        <p className="text-sm font-semibold text-charcoal leading-tight">{label}</p>
        <p className="text-small text-warmGray mt-1">
          {t('Phạm vi: {{min}}–{{max}} • Mặc định: {{value}}', { min, max, value: defaultValue })}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/50">
        <button type="button" onClick={() => onChange(clamp(value - step))} disabled={atMin}
          aria-label={t('Giảm {{label}}', { label })}
          className={cn('h-9 w-9 max-sm:h-11 max-sm:w-11 rounded-lg text-base font-bold flex items-center justify-center select-none transition-colors',
            atMin ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-white text-charcoal border border-stone-200 hover:bg-stone-50 active:scale-95')}>
          −
        </button>
        <span className="text-sm font-bold text-charcoal px-2 py-0.5 rounded bg-white border border-stone-200/80 min-w-[76px] text-center">
          {value.toFixed(decimals)} <span className="text-xs font-normal text-warmGray">{unit}</span>
        </span>
        <button type="button" onClick={() => onChange(clamp(value + step))} disabled={atMax}
          aria-label={t('Tăng {{label}}', { label })}
          className={cn('h-9 w-9 max-sm:h-11 max-sm:w-11 rounded-lg text-base font-bold flex items-center justify-center select-none transition-colors',
            atMax ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-white text-charcoal border border-stone-200 hover:bg-stone-50 active:scale-95')}>
          +
        </button>
      </div>
    </div>
  )
}

// Hệ số mờ của Zone (ENV-FR-021/022) và gợi ý từ dữ liệu (ANALYTICS-FR-010); chỉ gửi hệ số đã đổi để lịch sử ghi đúng phần thay đổi
const FuzzyTuningColumn = forwardRef<TuningBlockHandle, Props>(function FuzzyTuningColumn(
  { data, isLoading, isSaving, onSave, suggestion, isSuggestionLoading = false, suggestionAction, onDirtyChange }, ref,
) {
  const [form, setForm] = useState<ExpertFuzzyTuning>(DEFAULT_FUZZY_TUNING)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  const base = data ?? DEFAULT_FUZZY_TUNING
  // Số của Zone đang chọn chưa tải xong thì không có gì để lưu: lúc đó base là bộ mặc định, form có thể còn số của Zone trước
  const dirtyCount = !data ? 0 : TILES.filter(tile => form[tile.key] !== base[tile.key]).length
    + (form.fuzzy_input_filter !== base.fuzzy_input_filter ? 1 : 0)
  useEffect(() => { onDirtyChange?.(dirtyCount) }, [dirtyCount, onDirtyChange])

  function handleSave() {
    if (!data) return
    const changed: Partial<ExpertFuzzyTuning> = {}
    for (const tile of TILES) {
      if (form[tile.key] !== base[tile.key]) changed[tile.key] = form[tile.key]
    }
    if (form.fuzzy_input_filter !== base.fuzzy_input_filter) changed.fuzzy_input_filter = form.fuzzy_input_filter
    if (Object.keys(changed).length > 0) onSave(changed)
  }

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: () => setForm(base),
  }))

  if (isLoading) return (
    <div className="w-full bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 animate-pulse space-y-4">
      <div className="h-6 bg-stone-100 rounded w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 bg-stone-100 rounded-2xl" />)}
      </div>
    </div>
  )

  return (
    <div className="w-full bg-white rounded-2xl p-6 border border-stone-200/80 shadow-2xs space-y-4">
      <div className="pb-3 border-b border-stone-100">
        <h3 className="text-base font-bold text-charcoal">{t('1. Hệ số điều khiển mờ')}</h3>
        <p className="text-xs text-warmGray mt-0.5">{t('Lưu xong, cấu hình gửi xuống bộ điều khiển của Zone')}</p>
      </div>

      <FuzzySuggestionBox
        suggestion={suggestion}
        isLoading={isSuggestionLoading}
        action={suggestionAction}
        onDismiss={() => setSuggestionDismissed(true)}
        dismissed={suggestionDismissed}
      />

      {/* Nút Lưu chung ở thanh dính đáy của trang (DE-04) */}
      <fieldset disabled={isSaving} className="contents">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {TILES.map(tile => (
            <FuzzyTile
              key={tile.key}
              label={t(tile.label)}
              value={form[tile.key]}
              onChange={value => setForm(previous => ({ ...previous, [tile.key]: value }))}
              min={FUZZY_TUNING_LIMITS[tile.key].min}
              max={FUZZY_TUNING_LIMITS[tile.key].max}
              step={tile.step}
              decimals={tile.decimals}
              unit={t(FUZZY_TUNING_LIMITS[tile.key].unit)}
              defaultValue={DEFAULT_FUZZY_TUNING[tile.key]}
            />
          ))}
        </div>

        {/* ENV-FR-022 — cờ lọc nhiễu đầu vào */}
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-stone-200/70 bg-gray-50/60 p-4">
          <div>
            {/* Câu ngắn trên thẻ (C-07), giải thích đầy đủ của W-20 trong nút (i) */}
            <p className="flex items-center gap-1 text-sm font-semibold text-charcoal">
              {t('Lọc nhiễu số đo')}
              <InfoTip>{t('Làm mượt nhiệt độ và độ ẩm trước khi đưa vào bộ điều khiển để rơ-le ít đóng cắt vì nhiễu. Tắt tạm để so sánh số lần đóng cắt mỗi giờ.')}</InfoTip>
            </p>
            <p className="text-small text-warmGray mt-1">{t('Làm mượt số đo để rơ-le ít đóng cắt vì nhiễu')}</p>
          </div>
          <Toggle
            checked={form.fuzzy_input_filter}
            onChange={checked => setForm(previous => ({ ...previous, fuzzy_input_filter: checked }))}
            aria-label={t('Lọc nhiễu số đo')}
          />
        </div>
      </fieldset>
    </div>
  )
})

export default FuzzyTuningColumn
