import { PencilSimpleIcon } from '@phosphor-icons/react'
import { Badge, Button, Toggle } from '@/components/ui'
import { recommendationsDict } from '@/constants/recommendations.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useRecommendationText } from '@/hooks/shared/useRecommendationText'
import { cn } from '@/lib/cn'
import type { RecommendationRule } from '@/types'

interface Props {
  rule: RecommendationRule
  disabled?: boolean
  // Farm Owner trên farm có chuyên gia không bật/tắt, không sửa luật đang chạy
  toggleDisabled?: boolean
  editDisabled?: boolean
  onToggle: () => void
  onEdit: () => void
}

// một luật: công tắc bật/tắt, tên, điều kiện, đề xuất khi chấp nhận, nguồn
export default function RecommendationRuleRow({ rule, disabled, toggleDisabled, editDisabled, onToggle, onEdit }: Props) {
  const { t } = useTranslation(recommendationsDict)
  const text = useRecommendationText()

  return (
    <div className={cn('flex items-start gap-3 py-3.5', !rule.active && 'opacity-60')}>
      <Toggle
        checked={rule.active}
        onChange={onToggle}
        disabled={disabled || toggleDisabled}
        aria-label={t(rule.active ? 'rules.turnOff' : 'rules.turnOn')}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-charcoal">
          {rule.name}
          {rule.pending_approval && <Badge tone="warning">{t('rules.pending')}</Badge>}
        </p>
        <p className="text-small text-charcoal">{text.condition(rule)}</p>
        <p className="text-small text-graphite">{text.action(rule.action)}</p>
        <p className="break-words text-caption italic text-warmGray">{t('rules.source', { source: rule.source })}</p>
      </div>
      <Button variant="icon" size="sm" onClick={onEdit} disabled={disabled || editDisabled} className="shrink-0" aria-label={t('rules.edit')} title={t('rules.edit')}>
        <PencilSimpleIcon size={16} />
      </Button>
    </div>
  )
}
