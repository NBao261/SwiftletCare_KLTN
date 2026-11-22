// Form thêm luật bù thời tiết: metric, min, offset_pct (−10…+10 ≠ 0), duration_min (1…120)
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import { Input } from '@/components/ui/Input'
import type { WeatherRule } from '@/types/expert.types'
import { validateWeatherRule, isWeatherRuleValid, METRIC_MIN_RANGE } from '@/validations/common/weatherRule.validation'
import { t } from '@/i18n'

type DraftRule = Omit<Partial<WeatherRule>, 'metric'> & { metric: WeatherRule['metric'] | '' }

const BLANK = { metric: '' as DraftRule['metric'], min: undefined as number | undefined, offset_pct: undefined as number | undefined, duration_min: 60, active: true } satisfies DraftRule

type MetricValue = WeatherRule['metric'] | ''

const METRIC_OPTIONS: SelectMenuOption<MetricValue>[] = [
  { value: '', label: 'Chọn chỉ số' },
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

  return (
    <Card className="space-y-4">
      <p className="text-sm font-semibold text-charcoal">{t('Thêm luật mới')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="label-caption">{t('Chỉ số thời tiết')}</span>
          <SelectMenu
            value={draft.metric}
            options={METRIC_OPTIONS}
            onChange={value => setDraft(current => ({ ...current, metric: value, min: undefined }))}
            ariaLabel={t('Chọn chỉ số thời tiết')}
            field
            invalid={!!errors.metric}
            disabled={disabled}
            highlightFiltered={false}
          />
          {errors.metric && <span className="text-xs text-alertRed">{errors.metric}</span>}
        </div>

        <Input
          id="wr-min"
          type="number"
          label={metaRange ? t('Ngưỡng ({{min}}…{{max}} {{unit}})', { min: metaRange.min, max: metaRange.max, unit: metaRange.unit }) : t('Ngưỡng')}
          value={draft.min ?? ''}
          onChange={event => setDraft(current => ({ ...current, min: event.target.value === '' ? undefined : Number(event.target.value) }))}
          disabled={disabled || !draft.metric}
          placeholder={metaRange ? `vd. ${metaRange.max * 0.7 | 0}` : '—'}
          error={errors.min}
        />

        <Input
          id="wr-offset"
          type="number"
          label={t('Mức bù phun (−10…+10, ≠ 0)')}
          value={draft.offset_pct ?? ''}
          onChange={event => setDraft(current => ({ ...current, offset_pct: event.target.value === '' ? undefined : Number(event.target.value) }))}
          disabled={disabled}
          step={1}
          placeholder={t('vd. +5 hoặc −3')}
          error={errors.offset_pct}
        />

        <Input
          id="wr-duration"
          type="number"
          label={t('Thời hạn (1…120 phút)')}
          value={draft.duration_min ?? ''}
          onChange={event => setDraft(current => ({ ...current, duration_min: event.target.value === '' ? undefined : Number(event.target.value) }))}
          disabled={disabled}
          step={1}
          placeholder="vd. 60"
          error={errors.duration_min}
        />
      </div>

      <Button variant="primary" size="sm" onClick={handleSubmit} disabled={disabled}>
        <Plus className="w-3.5 h-3.5" />
        {t('Thêm luật')}
      </Button>
    </Card>
  )
}
