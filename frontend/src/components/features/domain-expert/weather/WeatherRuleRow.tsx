// ENV-FR-030, BR-38 — Một dòng luật bù thời tiết (xem + toggle + xoá)
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Toggle } from '@/components/ui/Toggle'
import type { WeatherRule } from '@/types/expert.types'

const METRIC_LABELS: Record<WeatherRule['metric'], string> = {
  temperature: 'Nhiệt độ cao nhất',
  humidity:    'Độ ẩm ngoài trời cao nhất',
  rain:        'Tổng mưa',
}
const METRIC_UNITS: Record<WeatherRule['metric'], string> = {
  temperature: '°C',
  humidity:    '%',
  rain:        'mm',
}

interface Props {
  rule: WeatherRule
  onToggle: () => void
  onRemove: () => void
  disabled?: boolean
}

export default function WeatherRuleRow({ rule, onToggle, onRemove, disabled }: Props) {
  const sign = rule.offset_pct > 0 ? '+' : ''
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl border text-sm transition-colors bg-white',
      rule.active ? 'border-warmGray/15' : 'border-warmGray/10 opacity-60',
    )}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Toggle
          checked={rule.active}
          onChange={onToggle}
          disabled={disabled}
          aria-label={rule.active ? 'Tắt luật' : 'Bật luật'}
        />

        <span className="font-medium text-charcoal truncate">
          {METRIC_LABELS[rule.metric]} ≥ <b>{rule.min}</b> {METRIC_UNITS[rule.metric]}
        </span>

        <span className="text-warmGray shrink-0">→</span>

        <span className={cn(
          'shrink-0 px-2 py-0.5 rounded-full font-semibold border text-xs',
          rule.offset_pct > 0
            ? 'bg-infoBlue/5 text-infoBlue border-infoBlue/20'
            : 'bg-climateOrange/10 text-climateOrange border-climateOrange/20',
        )}>
          {sign}{rule.offset_pct}% phun
        </span>

        <span className="text-warmGray text-xs shrink-0">{rule.duration_min} phút</span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Xoá luật"
        className="shrink-0 text-warmGray hover:text-alertRed transition-colors p-1 rounded disabled:opacity-40"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
