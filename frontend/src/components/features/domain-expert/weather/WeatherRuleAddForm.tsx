// ENV-FR-030, BR-38 — Form thêm luật bù thời tiết: metric, min, offset_pct (−10…+10 ≠ 0), duration_min (1…120)
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import type { WeatherRule } from '@/types/expert.types'
import { validateWeatherRule, isWeatherRuleValid, METRIC_MIN_RANGE } from '@/validations/common/weatherRule.validation'

type DraftRule = Omit<Partial<WeatherRule>, 'metric'> & { metric: WeatherRule['metric'] | '' }

const BLANK = { metric: '' as DraftRule['metric'], min: undefined as number | undefined, offset_pct: undefined as number | undefined, duration_min: 60, active: true } satisfies DraftRule

const METRIC_OPTIONS: { value: WeatherRule['metric']; label: string }[] = [
  { value: 'temperature', label: 'Nhiệt độ cao nhất (°C)' },
  { value: 'humidity',    label: 'Độ ẩm ngoài trời cao nhất (%)' },
  { value: 'rain',        label: 'Tổng lượng mưa (mm)' },
]

interface Props {
  onAdd: (rule: WeatherRule) => void
  disabled?: boolean
}

export default function WeatherRuleAddForm({ onAdd, disabled }: Props) {
  const [draft, setDraft] = useState<DraftRule>(BLANK)
  const [touched, setTouched] = useState(false)

  const errors = touched ? validateWeatherRule(draft as Partial<WeatherRule>) : {}
  const canAdd = isWeatherRuleValid(draft as Partial<WeatherRule>)

  const metaRange = draft.metric ? METRIC_MIN_RANGE[draft.metric] : null

  function handleSubmit() {
    setTouched(true)
    if (!canAdd) return
    onAdd({ ...(draft as WeatherRule), active: true })
    setDraft(BLANK)
    setTouched(false)
  }

  const inputCls = (err?: string) => cn(
    'w-full rounded-lg border px-2.5 py-1.5 text-sm text-charcoal bg-white outline-none transition-colors',
    err ? 'border-alertRed focus:ring-1 focus:ring-alertRed/30' : 'border-warmGray/15 focus:border-charcoal focus:ring-1 focus:ring-charcoal/20',
    disabled && 'opacity-50 cursor-not-allowed',
  )

  return (
    <div className="rounded-2xl border border-dashed border-warmGray/30 bg-warmGray/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-charcoal">Thêm luật mới</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs text-warmGray font-medium">Chỉ số thời tiết</label>
          <select
            value={draft.metric}
            onChange={e => setDraft(d => ({ ...d, metric: e.target.value as WeatherRule['metric'], min: undefined }))}
            disabled={disabled}
            className={cn(inputCls(errors.metric), 'appearance-none')}
          >
            <option value="">— Chọn chỉ số —</option>
            {METRIC_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {errors.metric && <p className="text-xs text-alertRed">{errors.metric}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-warmGray font-medium">
            Ngưỡng {metaRange ? `(${metaRange.min}…${metaRange.max} ${metaRange.unit})` : ''}
          </label>
          <input
            type="number"
            value={draft.min ?? ''}
            onChange={e => setDraft(d => ({ ...d, min: e.target.value === '' ? undefined : Number(e.target.value) }))}
            disabled={disabled || !draft.metric}
            placeholder={metaRange ? `vd. ${metaRange.max * 0.7 | 0}` : '—'}
            className={inputCls(errors.min)}
          />
          {errors.min && <p className="text-xs text-alertRed">{errors.min}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-warmGray font-medium">Mức bù phun (−10…+10, ≠ 0)</label>
          <input
            type="number"
            value={draft.offset_pct ?? ''}
            onChange={e => setDraft(d => ({ ...d, offset_pct: e.target.value === '' ? undefined : Number(e.target.value) }))}
            disabled={disabled}
            step={1}
            placeholder="vd. +5 hoặc −3"
            className={inputCls(errors.offset_pct)}
          />
          {errors.offset_pct && <p className="text-xs text-alertRed">{errors.offset_pct}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-warmGray font-medium">Thời hạn (1…120 phút)</label>
          <input
            type="number"
            value={draft.duration_min ?? ''}
            onChange={e => setDraft(d => ({ ...d, duration_min: e.target.value === '' ? undefined : Number(e.target.value) }))}
            disabled={disabled}
            step={1}
            placeholder="vd. 60"
            className={inputCls(errors.duration_min)}
          />
          {errors.duration_min && <p className="text-xs text-alertRed">{errors.duration_min}</p>}
        </div>
      </div>

      <Button variant="primary" size="sm" onClick={handleSubmit} disabled={disabled}>
        <Plus className="w-3.5 h-3.5" />
        Thêm luật
      </Button>
    </div>
  )
}
