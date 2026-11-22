import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Toggle } from '@/components/ui'
import { DEFAULT_FUZZY_TUNING } from '@/constants/thresholds'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { FUZZY_TUNING_LIMITS } from '@/validations/common/fuzzyTuning.validation'
import FuzzySuggestionBox, { type SuggestionAction } from '@/components/features/domain-expert/tuning/FuzzySuggestionBox'
import type { ExpertFuzzyTuning, FuzzySuggestionResponse } from '@/types/expert.types'

interface Props {
  data: ExpertFuzzyTuning | undefined
  isLoading: boolean
  isSaving: boolean
  onSave: (changed: Partial<ExpertFuzzyTuning>) => void
  suggestion?: FuzzySuggestionResponse
  isSuggestionLoading?: boolean
  suggestionAction?: SuggestionAction
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
          className={cn('w-7 h-7 rounded-lg text-base font-bold flex items-center justify-center select-none transition-colors',
            atMin ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-white text-charcoal border border-stone-200 hover:bg-stone-50 active:scale-95')}>
          −
        </button>
        <span className="text-sm font-bold text-charcoal px-2 py-0.5 rounded bg-white border border-stone-200/80 min-w-[76px] text-center">
          {value.toFixed(decimals)} <span className="text-xs font-normal text-warmGray">{unit}</span>
        </span>
        <button type="button" onClick={() => onChange(clamp(value + step))} disabled={atMax}
          aria-label={t('Tăng {{label}}', { label })}
          className={cn('w-7 h-7 rounded-lg text-base font-bold flex items-center justify-center select-none transition-colors',
            atMax ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-white text-charcoal border border-stone-200 hover:bg-stone-50 active:scale-95')}>
          +
        </button>
      </div>
    </div>
  )
}

// Hệ số mờ của Zone và gợi ý từ dữ liệu; chỉ gửi hệ số đã đổi để lịch sử ghi đúng phần thay đổi
export default function FuzzyTuningColumn({ data, isLoading, isSaving, onSave, suggestion, isSuggestionLoading = false, suggestionAction }: Props) {
  const [form, setForm] = useState<ExpertFuzzyTuning>(DEFAULT_FUZZY_TUNING)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  function handleSave() {
    const base = data ?? DEFAULT_FUZZY_TUNING
    const changed: Partial<ExpertFuzzyTuning> = {}
    for (const tile of TILES) {
      if (form[tile.key] !== base[tile.key]) changed[tile.key] = form[tile.key]
    }
    if (form.fuzzy_input_filter !== base.fuzzy_input_filter) changed.fuzzy_input_filter = form.fuzzy_input_filter
    if (Object.keys(changed).length > 0) onSave(changed)
  }

  if (isLoading) return (
    <div className="w-full bg-white rounded-[24px] border border-stone-200/80 shadow-sm p-6 animate-pulse space-y-4">
      <div className="h-6 bg-stone-100 rounded w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 bg-stone-100 rounded-2xl" />)}
      </div>
    </div>
  )

  return (
    <div className="w-full bg-white rounded-[24px] p-6 border border-stone-200/80 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div>
          <h3 className="text-base font-bold text-charcoal">{t('1. Hệ số điều khiển mờ')}</h3>
          <p className="text-xs text-warmGray mt-0.5">{t('Lưu xong, hệ thống gửi cấu hình mới xuống bộ điều khiển của Zone')}</p>
        </div>
        <button type="button" onClick={handleSave} disabled={isSaving}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition-all duration-150 self-start sm:self-center shrink-0',
            isSaving ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-charcoal text-white hover:bg-gray-800 shadow-sm',
          )}>
          {isSaving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          <Save className="w-3.5 h-3.5" />
          {t('Lưu hệ số mờ')}
        </button>
      </div>

      <FuzzySuggestionBox
        suggestion={suggestion}
        isLoading={isSuggestionLoading}
        action={suggestionAction}
        onDismiss={() => setSuggestionDismissed(true)}
        dismissed={suggestionDismissed}
      />

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

      {/* cờ lọc nhiễu đầu vào */}
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-stone-200/70 bg-gray-50/60 p-4">
        <div>
          <p className="text-sm font-semibold text-charcoal">{t('Lọc nhiễu số đo')}</p>
          <p className="text-small text-warmGray mt-1">{t('Làm mượt nhiệt độ và độ ẩm trước khi đưa vào bộ điều khiển để rơ-le ít đóng cắt vì nhiễu. Tắt tạm để so sánh số lần đóng cắt mỗi giờ.')}</p>
        </div>
        <Toggle
          checked={form.fuzzy_input_filter}
          onChange={checked => setForm(previous => ({ ...previous, fuzzy_input_filter: checked }))}
          aria-label={t('Lọc nhiễu số đo')}
        />
      </div>
    </div>
  )
}
