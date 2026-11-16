import { Pencil } from 'lucide-react'
import { Button, Toggle } from '@/components/ui'
import { recommendationsDict } from '@/constants/recommendations.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useRecommendationText } from '@/hooks/shared/useRecommendationText'
import { cn } from '@/lib/cn'
import type { RecommendationRule } from '@/types'

interface Props {
  rule: RecommendationRule
  disabled?: boolean
  onToggle: () => void
  onEdit: () => void
}

// EXPERT-FR-016 — một luật: công tắc bật/tắt, tên, điều kiện, đề xuất khi chấp nhận, nguồn
export default function RecommendationRuleRow({ rule, disabled, onToggle, onEdit }: Props) {
  const { t } = useTranslation(recommendationsDict)
  const text = useRecommendationText()

  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', rule.active ? 'border-warmGray/15 bg-white' : 'border-warmGray/10 bg-warmGray/5')}>
      <Toggle
        checked={rule.active}
        onChange={onToggle}
        disabled={disabled}
        aria-label={t(rule.active ? 'rules.turnOff' : 'rules.turnOn')}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn('text-small font-semibold', rule.active ? 'text-charcoal' : 'text-warmGray')}>{rule.name}</p>
        <p className="text-small text-charcoal">{text.condition(rule)}</p>
        <p className="text-small text-graphite">{text.action(rule.action)}</p>
        <p className="break-words text-caption italic text-warmGray">{t('rules.source', { source: rule.source })}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onEdit} disabled={disabled} className="shrink-0">
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        {t('rules.edit')}
      </Button>
    </div>
  )
}
