// ENV-FR-028…030, BR-38, BR-22 — luật bù phun sương của nhà; Farm Owner ở farm có chuyên gia gửi đề xuất
import { useState, useEffect } from 'react'
import { CloudRain, Info, Zap, AlertTriangle, Send } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import SectionCard from '@/components/ui/SectionCard'
import NoteActionModal from '@/components/ui/NoteActionModal'
import { useZoneStore } from '@/stores/zoneStore'
import { useToastStore } from '@/stores/toastStore'
import {
  useApproveWeatherProposal, useProposeWeatherRules, useRejectWeatherProposal, useUpdateWeatherRules, useWeatherRules,
} from '@/hooks/domain-expert/useWeatherRules'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import type { WeatherRule } from '@/types/expert.types'
import WeatherRuleRow from '@/components/features/domain-expert/weather/WeatherRuleRow'
import WeatherRuleAddForm from '@/components/features/domain-expert/weather/WeatherRuleAddForm'
import { formatDate } from '@/lib/helpers'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { t } from '@/i18n'

const MAX_RULES = 10

function LastCompensationBadge({ data }: {
  data: NonNullable<import('@/types/expert.types').WeatherRulesResponse['last_compensation']>
}) {
  const sign = data.offset_pct > 0 ? '+' : ''
  const forecast = data.forecast
  return (
    <div className="flex flex-wrap items-start gap-3 p-3.5 rounded-2xl bg-infoBlue/5 border border-infoBlue/20 text-sm">
      <Zap className="w-4 h-4 text-infoBlue shrink-0 mt-0.5" />
      <div className="space-y-0.5 min-w-0">
        <p className="font-semibold text-charcoal">
          {t('Lần bù gần nhất:')} <span className="text-charcoal">{t('{{offset}}% phun', { offset: `${sign}${data.offset_pct}` })}</span>
          <span className="ml-2 font-normal text-infoBlue/80">{t('lúc {{time}}', { time: formatDate(data.sent_at) })}</span>
        </p>
        <p className="text-infoBlue/80">
          {t('Hết hạn lúc {{time}}', { time: formatDate(data.expires_at) })}
          {forecast.temperature_max !== null && <> · {t('Nhiệt:')} {forecast.temperature_max}°C</>}
          {forecast.humidity_max !== null && <> · {t('Độ ẩm:')} {forecast.humidity_max}%</>}
          {forecast.rain_mm !== null && <> · {t('Mưa:')} {forecast.rain_mm} mm</>}
        </p>
      </div>
    </div>
  )
}

export default function DomainExpertWeatherRulesPage() {
  const { canEditParameters, ownerNeedsExpert, isExpert } = useExpertDecisionRights()
  const { selectedHouseId } = useZoneStore()
  const houseId = selectedHouseId ?? undefined
  const { data, isLoading, isError } = useWeatherRules(houseId)
  // Farm Owner trên farm có chuyên gia: bộ luật soạn ở đây gửi thành đề xuất, luật đang chạy giữ nguyên
  const update = useUpdateWeatherRules(houseId)
  const propose = useProposeWeatherRules(houseId)
  const mutation = ownerNeedsExpert ? propose : update
  const approve = useApproveWeatherProposal(houseId)
  const reject = useRejectWeatherProposal(houseId)
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const getErrorMessage = useApiErrorMessage()
  const pushToast = useToastStore(state => state.push)

  const [localRules, setLocalRules] = useState<WeatherRule[] | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setLocalRules(null)
    setSaveError(null)
  }, [selectedHouseId])

  const rules: WeatherRule[] = localRules ?? data?.rules ?? []
  const isDirty = localRules !== null

  function handleAdd(rule: WeatherRule) {
    setLocalRules(currentRules => [...(currentRules ?? data?.rules ?? []), rule])
  }

  function handleRemove(index: number) {
    setLocalRules(currentRules => {
      const base = currentRules ?? data?.rules ?? []
      return base.filter((_, position) => position !== index)
    })
  }

  function handleToggle(index: number) {
    setLocalRules(currentRules => {
      const base = currentRules ?? data?.rules ?? []
      return base.map((rule, position) => position === index ? { ...rule, active: !rule.active } : rule)
    })
  }

  async function handleSave() {
    setSaveError(null)
    try {
      await mutation.mutateAsync(rules)
      setLocalRules(null)
      pushToast(ownerNeedsExpert ? t('Đã gửi chuyên gia duyệt. Luật đang chạy giữ nguyên tới khi được duyệt.') : t('Đã lưu luật bù thời tiết.'), 'success')
    } catch (error) {
      setSaveError(getErrorMessage(error))
    }
  }

  function decide(action: Promise<unknown>, doneMessage: string) {
    action
      .then(() => { pushToast(t(doneMessage), 'success'); setIsRejectOpen(false) })
      // 409: đề xuất vừa đổi hoặc đã có người xử lý, danh sách đọc lại (hook) để chuyên gia xem bản mới
      .catch(error => { pushToast(getErrorMessage(error), 'error'); setIsRejectOpen(false) })
  }

  // Đề xuất đang chờ của Farm Owner: chuyên gia duyệt hoặc từ chối, Farm Owner thấy mình đã gửi gì
  function renderProposal() {
    const proposal = data?.proposal
    if (!proposal) return null
    return (
      <div className="space-y-3 p-4 rounded-2xl border border-statusYellow/40 bg-statusYellow/5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <Send className="w-4 h-4 shrink-0" />
            {t('Đề xuất của chủ nhà yến đang chờ duyệt ({{n}} luật, gửi lúc {{time}})', { n: proposal.rules.length, time: formatDate(proposal.proposed_at) })}
          </p>
          {isExpert && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsRejectOpen(true)} disabled={approve.isPending}>{t('Từ chối')}</Button>
              <Button size="sm" loading={approve.isPending} onClick={() => decide(approve.mutateAsync(proposal.proposed_at), 'Đã duyệt, luật mới có hiệu lực từ lần tính kế tiếp.')}>
                {t('Duyệt đề xuất')}
              </Button>
            </div>
          )}
        </div>
        {ownerNeedsExpert && <p className="text-small text-graphite">{t('Gửi lại bộ luật mới sẽ thay đề xuất này.')}</p>}
        <fieldset disabled className="space-y-1.5">
          {proposal.rules.map((rule, index) => (
            <WeatherRuleRow key={rule._id ?? index} rule={rule} onToggle={() => undefined} onRemove={() => undefined} disabled />
          ))}
        </fieldset>
      </div>
    )
  }

  function handleDiscard() {
    setLocalRules(null)
    setSaveError(null)
  }

  function renderLastCompensation() {
    if (isLoading) return <LoadingSkeleton count={1} className="h-14 w-full rounded-2xl" />
    if (isError) return null
    if (data?.last_compensation) return <LastCompensationBadge data={data.last_compensation} />
    // Không hiện hộp "chưa có bù" khi chưa có luật nào — EmptyState bên dưới đã đủ
    if (!rules.length) return null
    return (
      <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-warmGray/5 border border-warmGray/15 text-sm text-warmGray">
        <Info className="w-4 h-4 shrink-0" />
        <span>{t('Chưa có lần bù nào kể từ khi luật được lưu (hoặc chưa có luật nào thoả dự báo).')}</span>
      </div>
    )
  }

  function renderRulesList() {
    if (isLoading) return <LoadingSkeleton count={3} className="h-12 w-full rounded-2xl" />
    if (rules.length === 0) {
      return (
        <EmptyState
          icon={<CloudRain className="w-8 h-8" />}
          title={t('Chưa có luật nào. Thêm luật đầu tiên bên dưới.')}
        />
      )
    }
    return (
      <div className="space-y-1.5">
        {rules.map((rule, index) => (
          <WeatherRuleRow
            key={rule._id ?? index}
            rule={rule}
            onToggle={() => handleToggle(index)}
            onRemove={() => handleRemove(index)}
            disabled={mutation.isPending}
          />
        ))}
      </div>
    )
  }

  if (!selectedHouseId) {
    return (
      <EmptyState
        icon={<CloudRain className="w-8 h-8" />}
        title={t('Chọn nhà yến ở thanh trên để xem luật bù thời tiết')}
      />
    )
  }

  return (
    // BR-22 — Farm Owner soạn được; farm có chuyên gia thì nút lưu gửi đề xuất
    <fieldset disabled={!canEditParameters} className="contents">
    <div className="mx-auto w-full max-w-screen-xl space-y-5">
      <SectionCard
        icon={<CloudRain className="w-5 h-5" />}
        title={t('Luật bù phun sương theo thời tiết')}
        description={t('Mỗi giờ hệ thống tự chọn luật khớp với dự báo thời tiết và điều chỉnh mức phun sương trong khoảng ±10%, hiệu lực tối đa 2 giờ. Khi nhiều luật khớp, áp luật có mức bù lớn nhất.')}
        action={!isLoading && rules.length >= MAX_RULES ? (
          <span className="text-xs text-charcoal bg-statusYellow/10 border border-statusYellow/40 px-2 py-0.5 rounded-full font-semibold">
            {t('Đã đạt tối đa 10 luật')}
          </span>
        ) : undefined}
      >
        <div className="space-y-4">
          {/* Lỗi tải dữ liệu */}
          {isError && !isLoading && (
            <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-alertRed/5 border border-alertRed/20 text-sm text-alertRed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('Không tải được luật bù thời tiết. Thử lại.')}</span>
            </div>
          )}

          {/* Lần bù gần nhất */}
          {renderLastCompensation()}

          {renderProposal()}

          {/* Danh sách luật — ẩn khi GET lỗi */}
          {!isError && (
            <>
              <h2 className="text-sm font-semibold text-charcoal">
                {t('Danh sách luật ({{n}}/{{max}})', { n: isLoading ? '…' : rules.length, max: MAX_RULES })}
              </h2>
              {renderRulesList()}
            </>
          )}
        </div>
      </SectionCard>

      {/* Form thêm luật */}
      {canEditParameters && !isError && !isLoading && rules.length < MAX_RULES && (
        <WeatherRuleAddForm onAdd={handleAdd} disabled={mutation.isPending} />
      )}

      {saveError && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-alertRed/5 border border-alertRed/20 text-sm text-alertRed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {isDirty && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-warmGray/10">
          <Button variant="secondary" size="sm" onClick={handleDiscard} disabled={mutation.isPending}>
            {t('Huỷ thay đổi')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={mutation.isPending}
          >
            {ownerNeedsExpert ? t('Gửi chuyên gia duyệt') : t('Lưu luật')}
          </Button>
        </div>
      )}
    </div>
    <NoteActionModal
      open={isRejectOpen}
      onClose={() => setIsRejectOpen(false)}
      title={t('Từ chối đề xuất luật bù phun sương')}
      label={t('Lý do')}
      placeholder={t('VD: mùa này chưa cần phun thêm')}
      hint={t('Chủ nhà yến nhận lý do này. Luật đang chạy giữ nguyên.')}
      submitLabel={t('Từ chối')}
      required
      danger
      loading={reject.isPending}
      onSubmit={note => data?.proposal && decide(reject.mutateAsync({ note, proposedAt: data.proposal.proposed_at }), 'Đã từ chối đề xuất.')}
    />
    </fieldset>
  )
}
