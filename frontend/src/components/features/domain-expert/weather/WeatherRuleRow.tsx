// Một dòng luật bù thời tiết (xem + bật/tắt + xoá); các dòng nằm chung một khung, ngăn bằng vạch mảnh
import { TrashIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { Badge, Button } from '@/components/ui'
import { Toggle } from '@/components/ui/Toggle'
import type { WeatherRule } from '@/types/expert.types'
import { t, translated } from '@/i18n'

const METRIC_LABELS: Record<WeatherRule['metric'], string> = translated({
  temperature: 'Nhiệt độ cao nhất',
  humidity:    'Độ ẩm ngoài trời cao nhất',
  rain:        'Tổng mưa',
})
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
    <div className={cn('flex items-center justify-between gap-3 py-3 text-sm transition-opacity', !rule.active && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <Toggle
          checked={rule.active}
          onChange={onToggle}
          disabled={disabled}
          aria-label={rule.active ? t('Tắt luật') : t('Bật luật')}
        />

        <span className="font-medium text-charcoal">
          {METRIC_LABELS[rule.metric]} ≥ <b>{rule.min}</b> {METRIC_UNITS[rule.metric]}
        </span>

        <span className="shrink-0 text-warmGray">→</span>

        <Badge tone={rule.offset_pct > 0 ? 'info' : 'warning'} className="shrink-0">
          {t('{{offset}}% phun', { offset: `${sign}${rule.offset_pct}` })}
        </Badge>

        <span className="shrink-0 text-xs text-warmGray">{t('{{n}} phút', { n: rule.duration_min })}</span>
      </div>

      <Button variant="icon" size="sm" onClick={onRemove} disabled={disabled} aria-label={t('Xoá luật')} title={t('Xoá luật')}>
        <TrashIcon size={16} />
      </Button>
    </div>
  )
}
