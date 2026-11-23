// Luật khuyến nghị của farm: chuyên gia viết, sửa, bật/tắt luật và xem hiệu quả theo luật (phần 2)
import { useState } from 'react'
import { Lightbulb, Plus } from 'lucide-react'
import RecommendationEffectPanel from '@/components/features/domain-expert/recommendations/RecommendationEffectPanel'
import RecommendationRuleFormModal from '@/components/features/domain-expert/recommendations/RecommendationRuleFormModal'
import RecommendationRuleRow from '@/components/features/domain-expert/recommendations/RecommendationRuleRow'
import { Button, EmptyState, LoadingSkeleton, Pagination, SectionCard } from '@/components/ui'
import { recommendationsDict } from '@/constants/recommendations.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import {
  RULES_PAGE_SIZE, useRecommendationRuleEffects, useRecommendationRules, useSaveRecommendationRule,
} from '@/hooks/domain-expert/useRecommendationRules'
import { cn } from '@/lib/cn'
import { useToastStore } from '@/stores/toastStore'
import { useZoneStore } from '@/stores/zoneStore'
import type { RecommendationRule } from '@/types'
import { toggledRuleInput } from '@/validations/common/recommendationRule.validation'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'

const TABS = ['rules', 'effects'] as const
type RulesTab = (typeof TABS)[number]
const TAB_LABEL = { rules: 'rules.tabRules', effects: 'rules.tabEffects' } as const

export default function DomainExpertRecommendationRulesPage() {
  // Farm Owner viết luật; farm có chuyên gia thì luật chờ chuyên gia bật
  const { canEditParameters, ownerNeedsExpert } = useExpertDecisionRights()
  const { t } = useTranslation(recommendationsDict)
  const apiErrorMessage = useApiErrorMessage()
  const push = useToastStore(state => state.push)
  const farmId = useZoneStore(state => state.selectedFarmId) ?? undefined
  const [tab, setTab] = useState<RulesTab>('rules')
  // Đổi trại thì về trang 1
  const [pageState, setPageState] = useState({ farmId, page: 1 })
  const page = pageState.farmId === farmId ? pageState.page : 1
  const rules = useRecommendationRules(farmId, page)
  const effects = useRecommendationRuleEffects(tab === 'effects' ? farmId : undefined)
  const save = useSaveRecommendationRule(farmId)
  // undefined = popup đóng · null = thêm luật mới
  const [editing, setEditing] = useState<RecommendationRule | null | undefined>(undefined)

  function toggle(rule: RecommendationRule) {
    save.mutate({ id: rule._id, input: toggledRuleInput(rule) }, {
      onSuccess: () => push(t(rule.active ? 'rules.toggledOff' : 'rules.toggledOn')),
      onError: toggleError => push(apiErrorMessage(toggleError), 'error'),
    })
  }

  if (!farmId) return <EmptyState icon={<Lightbulb className="h-8 w-8" />} title={t('rules.pickFarm')} />

  // Tab Luật: tải → khung chờ; lỗi → báo kèm Thử lại; rỗng → khung rỗng; còn lại là danh sách luật
  let rulesBody = <LoadingSkeleton count={3} className="h-24 w-full rounded-2xl" />
  if (!rules.isLoading && rules.isError) {
    rulesBody = (
      <EmptyState
        title={t('common.loadError')}
        description={apiErrorMessage(rules.error)}
        action={<Button variant="secondary" size="sm" onClick={() => void rules.refetch()}>{t('common.retry')}</Button>}
      />
    )
  }
  if (!rules.isLoading && !rules.isError && rules.records.length === 0) {
    rulesBody = (
      <p className="py-6 text-center text-sm text-warmGray">{t('rules.emptyTitle')}</p>
    )
  }
  if (!rules.isLoading && !rules.isError && rules.records.length > 0) {
    rulesBody = (
      <div className="flex flex-col gap-2">
        {rules.records.map(rule => (
          <RecommendationRuleRow
            key={rule._id}
            rule={rule}
            disabled={save.isPending || !canEditParameters}
            toggleDisabled={ownerNeedsExpert}
            editDisabled={ownerNeedsExpert && !rule.pending_approval}
            onToggle={() => toggle(rule)}
            onEdit={() => setEditing(rule)}
          />
        ))}
        <Pagination page={page} limit={RULES_PAGE_SIZE} total={rules.total} onChange={next => setPageState({ farmId, page: next })} />
      </div>
    )
  }

  // Tab Hiệu quả: cùng ba trạng thái tải, lỗi, bảng
  let effectsBody = <LoadingSkeleton count={3} className="h-12 w-full" />
  if (!effects.isLoading && effects.isError) {
    effectsBody = (
      <EmptyState
        title={t('common.loadError')}
        description={apiErrorMessage(effects.error)}
        action={<Button variant="secondary" size="sm" onClick={() => void effects.refetch()}>{t('common.retry')}</Button>}
      />
    )
  }
  if (!effects.isLoading && !effects.isError) {
    effectsBody = (
      <div className="flex flex-col gap-3">
        <p className="text-small text-warmGray">{t('effects.subtitle')}</p>
        <RecommendationEffectPanel effects={effects.data ?? []} />
      </div>
    )
  }

  return (
    <>
      <SectionCard
        title={t('rules.title')}
        description={t('rules.subtitle')}
        action={tab === 'rules' && canEditParameters && (
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('rules.add')}
          </Button>
        )}
      >
        {/* Tab pill như trang Sức khỏe nhà yến */}
        <div className="inline-flex gap-1 self-start rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={t('rules.tabs')}>
          {TABS.map(value => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'h-9 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150',
                tab === value ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
              )}
            >
              {t(TAB_LABEL[value])}
            </button>
          ))}
        </div>
        {tab === 'rules' ? rulesBody : effectsBody}
      </SectionCard>

      <RecommendationRuleFormModal
        open={editing !== undefined}
        farmId={farmId}
        rule={editing ?? null}
        onClose={() => setEditing(undefined)}
      />
    </>
  )
}
