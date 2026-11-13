/**
 * WeatherRuleRow — Một dòng luật bù thời tiết trong bảng (xem + xoá + bật/tắt)
 * ENV-FR-030, BR-38
 */
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
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
      'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-xs transition-colors',
      rule.active ? 'bg-white border-neutral-200' : 'bg-neutral-50 border-neutral-100 opacity-60',
    )}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Toggle active */}
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={rule.active ? 'Tắt luật' : 'Bật luật'}
          className={cn(
            'shrink-0 w-8 h-4.5 rounded-full border transition-colors',
            rule.active ? 'bg-[#27231F] border-[#27231F]' : 'bg-neutral-200 border-neutral-300',
            disabled && 'cursor-not-allowed',
          )}
        >
          <span className={cn(
            'block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mx-0.5',
            rule.active ? 'translate-x-3.5' : 'translate-x-0',
          )} />
        </button>

        {/* Điều kiện */}
        <span className="font-medium text-[#27231F] truncate">
          {METRIC_LABELS[rule.metric]} ≥ <b>{rule.min}</b> {METRIC_UNITS[rule.metric]}
        </span>

        <span className="text-neutral-300 shrink-0">→</span>

        {/* Offset */}
        <span className={cn(
          'shrink-0 px-2 py-0.5 rounded-full font-bold border text-[10.5px]',
          rule.offset_pct > 0
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-orange-50 text-orange-700 border-orange-200',
        )}>
          {sign}{rule.offset_pct}% phun
        </span>

        {/* Thời hạn */}
        <span className="text-[#878380] shrink-0">{rule.duration_min} phút</span>
      </div>

      {/* Xoá */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Xoá luật"
        className="shrink-0 text-[#878380] hover:text-red-600 transition-colors p-1 rounded disabled:opacity-40"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
