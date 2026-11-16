import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Toggle } from '@/components/ui/Toggle'
import type { RecommendationRule } from '@/types/expert.types'

const METRIC_LABEL: Record<RecommendationRule['metric'], string> = {
  return_rate:             'Tỷ lệ về',
  health_status_good_rate: 'Tỷ lệ ngày GOOD',
  humidity_in_range:       'Độ ẩm trong ngưỡng',
  temp_in_range:           'Nhiệt độ trong ngưỡng',
}

const ACTION_LABEL: Record<RecommendationRule['action_type'], string> = {
  WORK_ORDER:   'Tạo Work Order',
  PARAM_CHANGE: 'Đổi tham số',
}

interface Props {
  rule: RecommendationRule
  onToggle: () => void
  onRemove: () => void
  disabled?: boolean
}

export default function RecommendationRuleRow({ rule, onToggle, onRemove, disabled }: Props) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-2xl border px-3.5 py-3 bg-white transition-colors',
      rule.active ? 'border-warmGray/15' : 'border-warmGray/10 opacity-60',
    )}>
      <Toggle
        checked={rule.active}
        onChange={onToggle}
        disabled={disabled}
        aria-label={rule.active ? 'Tắt luật' : 'Bật luật'}
      />

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-charcoal leading-snug">{rule.name}</p>
        <p className="text-xs text-warmGray">
          {METRIC_LABEL[rule.metric]} · cửa sổ {rule.window_days} ngày · ngưỡng {rule.threshold}
        </p>
        <span className="inline-block text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
          {ACTION_LABEL[rule.action_type]}
          {rule.work_order_type && ` — ${rule.work_order_type}`}
          {rule.param_key && ` — ${rule.param_key}`}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="shrink-0 mt-0.5 text-warmGray hover:text-alertRed disabled:opacity-50 transition-colors"
        title="Xoá luật"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
