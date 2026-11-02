/**
 * FuzzyTuningColumn — Tầng 1 Bento: Tham số điều khiển mờ (Fuzzy Logic) & Gợi ý AI
 * Card ngang full-width gồm Header, Thanh AI gợi ý và Lưới 4 ô tham số nằm ngang
 * SRS v2.1.4: EXPERT-FR-004/008, ANALYTICS-FR-010
 */
import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { cn } from '@/lib/cn'
import AiSuggestionBox from './AiSuggestionBox'
import type { ExpertFuzzyTuning, FuzzySuggestionResponse } from '@/types/expert.types'

interface Props {
  data: ExpertFuzzyTuning | undefined
  isLoading: boolean
  isSaving: boolean
  highlightedFields: Set<keyof ExpertFuzzyTuning>
  onSave: (v: Partial<ExpertFuzzyTuning>) => void
  onFormChange: (v: Partial<ExpertFuzzyTuning>) => void
  suggestion?: FuzzySuggestionResponse
  isSuggestionLoading?: boolean
  onApplySuggestion?: (sugg: Partial<ExpertFuzzyTuning>) => void
  onDismissSuggestion?: () => void
  suggestionDismissed?: boolean
}

function FuzzyTile({
  label, value, onChange, min, max, step = 1, decimals = 0, unit, rangeHint, defaultHint, highlighted,
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; decimals?: number; unit: string
  rangeHint?: string; defaultHint?: string; highlighted?: boolean
}) {
  const clamp = (v: number) => {
    const rounded = Math.round(v * 10 ** decimals) / 10 ** decimals
    if (min !== undefined && rounded < min) return min
    if (max !== undefined && rounded > max) return max
    return rounded
  }
  const atMin = min !== undefined && value <= min
  const atMax = max !== undefined && value >= max

  return (
    <div className={cn(
      'rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 shadow-2xs',
      highlighted ? 'bg-[#ECFFA9]/50 border-[#B5D32C]' : 'bg-[#F7F6F2]/60 border-stone-200/70 hover:border-stone-300',
    )}>
      <div>
        <p className="text-sm font-semibold text-[#27231F] leading-tight">{label}</p>
        <p className="text-[11px] text-[#878380] mt-1">{rangeHint} • {defaultHint}</p>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/50">
        <button type="button" onClick={() => onChange(clamp(value - step))} disabled={atMin}
          aria-label={`Giảm ${label}`}
          className={cn('w-7 h-7 rounded-lg text-base font-bold flex items-center justify-center select-none transition-colors',
            atMin ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-white text-[#27231F] border border-stone-200 hover:bg-stone-50 active:scale-95')}>
          −
        </button>
        <span className="text-sm font-bold text-[#27231F] px-2 py-0.5 rounded bg-white border border-stone-200/80 min-w-[76px] text-center">
          {decimals > 0 ? value.toFixed(decimals) : value} <span className="text-xs font-normal text-[#878380]">{unit}</span>
        </span>
        <button type="button" onClick={() => onChange(clamp(value + step))} disabled={atMax}
          aria-label={`Tăng ${label}`}
          className={cn('w-7 h-7 rounded-lg text-base font-bold flex items-center justify-center select-none transition-colors',
            atMax ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-white text-[#27231F] border border-stone-200 hover:bg-stone-50 active:scale-95')}>
          +
        </button>
      </div>
    </div>
  )
}

export default function FuzzyTuningColumn({
  data, isLoading, isSaving, highlightedFields, onSave, onFormChange,
  suggestion, isSuggestionLoading = false, onApplySuggestion, onDismissSuggestion, suggestionDismissed = false,
}: Props) {
  const [form, setForm] = useState<ExpertFuzzyTuning>({
    fuzzy_humidity_band: 8, fuzzy_temp_band: 4, fuzzy_fan_dry_level: 40,
    fuzzy_window_sec: 120, fuzzy_input_filter: true,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const set = (key: keyof ExpertFuzzyTuning) => (v: number | boolean) => {
    const next = { ...form, [key]: v }
    setForm(next)
    onFormChange(next)
  }

  if (isLoading) return (
    <div className="w-full bg-white rounded-[24px] border border-stone-200/80 shadow-sm p-6 animate-pulse space-y-4">
      <div className="h-6 bg-stone-100 rounded w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-stone-100 rounded-2xl" />)}
      </div>
    </div>
  )

  return (
    <div className="w-full bg-white rounded-[24px] p-6 border border-stone-200/80 shadow-2xs space-y-4">
      {/* Header (1 hàng ngang): Tiêu đề + trạng thái bên trái; Nút Lưu bên phải */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div>
          <h3 className="text-base font-bold text-[#27231F]">1. Tham số điều khiển mờ (Fuzzy Logic)</h3>
          <p className="text-xs text-[#878380] mt-0.5">Đang áp dụng cấu hình tiêu chuẩn của Zone</p>
        </div>
        <button type="button" onClick={() => onSave(form)} disabled={isSaving}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition-all duration-150 self-start sm:self-center shrink-0',
            isSaving ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-[#27231F] text-white hover:bg-[#3D3630] shadow-sm',
          )}>
          {isSaving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          <Save className="w-3.5 h-3.5" />
          Lưu hệ số mờ
        </button>
      </div>

      {/* Thanh Gợi ý AI tích hợp */}
      <AiSuggestionBox
        suggestion={suggestion}
        isLoading={isSuggestionLoading}
        onApply={s => onApplySuggestion?.(s)}
        onDismiss={() => onDismissSuggestion?.()}
        dismissed={suggestionDismissed}
      />

      {/* Lưới 4 Ô Ngang */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
        <FuzzyTile label="Dải biên độ ẩm" value={form.fuzzy_humidity_band} onChange={v => set('fuzzy_humidity_band')(v)}
          min={2} max={20} step={0.5} decimals={1} unit="%RH" rangeHint="Phạm vi: 2–20" defaultHint="Mặc định: 8"
          highlighted={highlightedFields.has('fuzzy_humidity_band')} />
        <FuzzyTile label="Dải biên nhiệt độ" value={form.fuzzy_temp_band} onChange={v => set('fuzzy_temp_band')(v)}
          min={1} max={10} step={0.5} decimals={1} unit="°C" rangeHint="Phạm vi: 1–10" defaultHint="Mặc định: 4"
          highlighted={highlightedFields.has('fuzzy_temp_band')} />
        <FuzzyTile label="Mức quạt khử ẩm" value={form.fuzzy_fan_dry_level} onChange={v => set('fuzzy_fan_dry_level')(v)}
          min={0} max={100} step={5} unit="%" rangeHint="Phạm vi: 0–100" defaultHint="Mặc định: 40"
          highlighted={highlightedFields.has('fuzzy_fan_dry_level')} />
        <FuzzyTile label="Chu kỳ cửa sổ điều khiển" value={form.fuzzy_window_sec} onChange={v => set('fuzzy_window_sec')(v)}
          min={60} max={600} step={10} unit="giây" rangeHint="Phạm vi: 60–600" defaultHint="Mặc định: 120s"
          highlighted={highlightedFields.has('fuzzy_window_sec')} />
      </div>
    </div>
  )
}
