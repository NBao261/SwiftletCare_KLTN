import { useEffect, useState, type FormEvent } from 'react'
import { Button, Input, Modal, SelectMenu, Textarea, Toggle } from '@/components/ui'
import { THRESHOLD_KEYS } from '@/constants/thresholds'
import { recommendationsDict, type RecommendationsKey } from '@/constants/recommendations.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useSaveRecommendationRule } from '@/hooks/domain-expert/useRecommendationRules'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { useToastStore } from '@/stores/toastStore'
import type { FuzzyNumericKey, RecommendationIndicator, RecommendationRule } from '@/types'
import { FUZZY_TUNING_LIMITS } from '@/validations/common/fuzzyTuning.validation'
import {
  RULE_NAME_MAX_LENGTH, RULE_SOURCE_MAX_LENGTH, RULE_TITLE_MAX_LENGTH, RULE_VALUE_LIMITS, RULE_WINDOW_MAX_DAYS, RULE_WINDOW_MIN_DAYS, draftOfRule, ruleInputOf, validateRuleDraft, type RuleDraft,
} from '@/validations/common/recommendationRule.validation'

const INDICATORS = Object.keys(RULE_VALUE_LIMITS) as RecommendationIndicator[]
const FUZZY_KEYS = Object.keys(FUZZY_TUNING_LIMITS) as FuzzyNumericKey[]

const BLANK: RuleDraft = {
  name: '', indicator: 'RETURN_RATE', comparison: 'LTE', value: '', window_days: '3',
  actionType: 'WORK_ORDER', title: '', group: 'thresholds', key: '', actionValue: '', source: '',
}

interface RecommendationRuleFormModalProps {
  open: boolean
  farmId: string
  // null = thêm luật mới
  rule: RecommendationRule | null
  onClose: () => void
}

// EXPERT-FR-016 — thêm hoặc sửa luật: chỉ số, so sánh, giá trị, số ngày liền, việc khi chấp nhận, nguồn
export default function RecommendationRuleFormModal({ open, farmId, rule, onClose }: RecommendationRuleFormModalProps) {
  const { t } = useTranslation(recommendationsDict)
  const apiErrorMessage = useApiErrorMessage()
  const push = useToastStore(state => state.push)
  const save = useSaveRecommendationRule(farmId)
  const [draft, setDraft] = useState<RuleDraft>(BLANK)
  const [active, setActive] = useState(true)
  // BR-22 — luật của Farm Owner ở farm có chuyên gia luôn tắt tới khi chuyên gia bật
  const { ownerNeedsExpert } = useExpertDecisionRights()
  const [submitted, setSubmitted] = useState(false)

  // Mở popup thì nạp luật đang sửa hoặc ô trống
  useEffect(() => {
    if (!open) return
    setDraft(rule ? draftOfRule(rule) : BLANK)
    setActive(rule ? rule.active : true)
    setSubmitted(false)
  }, [open, rule])

  const errors = submitted ? validateRuleDraft(draft) : {}
  const errorText = (field: keyof typeof errors) => (errors[field] ? t(`form.error.${errors[field]}` as RecommendationsKey) : undefined)
  const set = <K extends keyof RuleDraft>(field: K, value: RuleDraft[K]) => setDraft(previous => ({ ...previous, [field]: value }))
  const valueLimit = RULE_VALUE_LIMITS[draft.indicator]
  const paramKeys: string[] = draft.group === 'thresholds' ? [...THRESHOLD_KEYS] : FUZZY_KEYS

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateRuleDraft(draft)).length > 0) return
    save.mutate({ id: rule?._id, input: ruleInputOf(draft, active) }, {
      onSuccess: saved => {
        push(t(saved.data.data.pending_approval ? 'rules.savedPending' : 'rules.saved'))
        onClose()
      },
      onError: saveError => push(apiErrorMessage(saveError), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={t(rule ? 'form.editTitle' : 'form.createTitle')} size="lg" closeOnBackdrop={!save.isPending}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <hr className="border-gray-200" />
        {/* Thân popup cuộn khi màn thấp, tiêu đề và nút luôn hiện; đệm 4 phía để vòng focus của ô không bị cắt */}
        <div className="-mx-1 flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-1 pb-1 pr-3">
          <Input
            id="rule-name"
            label={t('form.name')}
            required
            maxLength={RULE_NAME_MAX_LENGTH}
            placeholder={t('form.namePlaceholder')}
            value={draft.name}
            onChange={event => set('name', event.target.value)}
            error={errorText('name')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="label-caption">{t('form.indicator')}</span>
              <SelectMenu
                field
                ariaLabel={t('form.indicator')}
                value={draft.indicator}
                onChange={value => set('indicator', value)}
                highlightFiltered={false}
                options={INDICATORS.map(item => ({ value: item, label: t(`indicator.${item}`) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="label-caption">{t('form.comparison')}</span>
              <SelectMenu
                field
                ariaLabel={t('form.comparison')}
                value={draft.comparison}
                onChange={value => set('comparison', value)}
                highlightFiltered={false}
                options={(['GTE', 'LTE'] as const).map(item => ({ value: item, label: t(`comparisonOption.${item}`) }))}
              />
            </div>
            <Input
              id="rule-value"
              label={t('form.value')}
              required
              type="number"
              inputMode="decimal"
              step="any"
              min={valueLimit.min}
              max={valueLimit.max}
              placeholder={t('form.valueHint', { min: valueLimit.min, max: valueLimit.max })}
              value={draft.value}
              onChange={event => set('value', event.target.value)}
              error={errorText('value')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Input
              id="rule-window"
              label={t('form.window')}
              required
              type="number"
              inputMode="numeric"
              min={RULE_WINDOW_MIN_DAYS}
              max={RULE_WINDOW_MAX_DAYS}
              step={1}
              value={draft.window_days}
              onChange={event => set('window_days', event.target.value)}
              error={errorText('window_days')}
            />
            <p className="text-caption text-warmGray">{t('form.windowHint')}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="label-caption">{t('form.actionType')}</span>
            <SelectMenu
              field
              ariaLabel={t('form.actionType')}
              value={draft.actionType}
              onChange={value => set('actionType', value)}
              highlightFiltered={false}
              options={(['WORK_ORDER', 'PARAMETER_CHANGE'] as const).map(item => ({ value: item, label: t(`actionType.${item}`) }))}
            />
          </div>

          {draft.actionType === 'WORK_ORDER' && (
            <Input
              id="rule-title"
              label={t('form.title')}
              required
              placeholder={t('form.titlePlaceholder')}
              maxLength={RULE_TITLE_MAX_LENGTH}
              value={draft.title}
              onChange={event => set('title', event.target.value)}
              error={errorText('title')}
            />
          )}

          {draft.actionType === 'PARAMETER_CHANGE' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <span className="label-caption">{t('form.group')}</span>
                <SelectMenu
                  field
                  ariaLabel={t('form.group')}
                  value={draft.group}
                  onChange={value => setDraft(previous => ({ ...previous, group: value, key: '', actionValue: '' }))}
                  highlightFiltered={false}
                  options={(['thresholds', 'fuzzy'] as const).map(item => ({ value: item, label: t(`group.${item}`) }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="label-caption">{t('form.key')}</span>
                <SelectMenu
                  field
                  ariaLabel={t('form.key')}
                  value={draft.key}
                  onChange={value => set('key', value)}
                  highlightFiltered={false}
                  options={[
                    { value: '', label: t('form.keyPlaceholder') },
                    ...paramKeys.map(key => ({ value: key, label: t(`param.${key}` as RecommendationsKey) })),
                  ]}
                />
                {errorText('key') && <span className="text-caption text-alertRed">{errorText('key')}</span>}
              </div>
              <Input
                id="rule-action-value"
                label={t('form.actionValue')}
                required
                type="number"
                inputMode="decimal"
                step="any"
                value={draft.actionValue}
                onChange={event => set('actionValue', event.target.value)}
                error={errorText('actionValue')}
              />
            </div>
          )}

          <Textarea
            id="rule-source"
            label={t('form.source')}
            required
            rows={2}
            maxLength={RULE_SOURCE_MAX_LENGTH}
            placeholder={t('form.sourcePlaceholder')}
            value={draft.source}
            onChange={event => set('source', event.target.value)}
            error={errorText('source')}
          />

          {ownerNeedsExpert ? (
            <p className="text-small text-warmGray">{t('rules.pendingHint')}</p>
          ) : (
            <label className="flex items-center gap-3 text-small text-charcoal">
              <Toggle checked={active} onChange={setActive} aria-label={t('form.active')} />
              {t('form.active')}
            </label>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>{t('form.cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{t('form.save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
