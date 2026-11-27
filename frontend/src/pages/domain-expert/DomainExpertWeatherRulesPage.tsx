// luật phun sương theo thời tiết của nhà; Farm Owner ở farm có chuyên gia gửi đề xuất
import { useState, useEffect } from 'react'
import { CloudRain, AlertTriangle } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { Badge, Button } from '@/components/ui'
import EmptyState from '@/components/ui/EmptyState'
import SectionCard from '@/components/ui/SectionCard'
import { Modal } from '@/components/ui/Modal'
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
import WeatherSource from '@/components/common/WeatherSource'
import { formatDate } from '@/lib/helpers'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { t } from '@/i18n'

const MAX_RULES = 10

// Lần chỉnh gần nhất: một khối trung tính, dòng trên là mức bù và lúc gửi, dòng dưới là hạn và số liệu dự báo
function LastCompensationBadge({ data }: {
  data: NonNullable<import('@/types/expert.types').WeatherRulesResponse['last_compensation']>
}) {
  const sign = data.offset_pct > 0 ? '+' : ''
  const forecast = data.forecast
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-warmGray/10 px-3.5 py-2.5 text-sm">
      <p className="font-semibold text-charcoal">
        {t('Lần chỉnh gần nhất:')} {t('{{offset}}% phun', { offset: `${sign}${data.offset_pct}` })}
        <span className="ml-2 font-normal text-warmGray">{t('lúc {{time}}', { time: formatDate(data.sent_at) })}</span>
      </p>
      <p className="text-small text-graphite">
        {t('Hết hạn lúc {{time}}', { time: formatDate(data.expires_at) })}
        {forecast.temperature_max !== null && <> · {t('Nhiệt:')} {forecast.temperature_max}°C</>}
        {forecast.humidity_max !== null && <> · {t('Độ ẩm:')} {forecast.humidity_max}%</>}
        {forecast.rain_mm !== null && <> · {t('Mưa:')} {forecast.rain_mm} mm</>}
      </p>
      <WeatherSource />
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
  // proposed_at của đề xuất lúc mở ô từ chối: đề xuất đổi trong lúc gõ thì backend trả 409
  const [rejectingAt, setRejectingAt] = useState<string | null>(null)
  const getErrorMessage = useApiErrorMessage()
  const pushToast = useToastStore(state => state.push)

  const [localRules, setLocalRules] = useState<WeatherRule[] | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    setLocalRules(null)
    setSaveError(null)
  }, [selectedHouseId])

  const rules: WeatherRule[] = localRules ?? data?.rules ?? []
  const isDirty = localRules !== null

  function handleAdd(rule: WeatherRule) {
    setLocalRules(currentRules => [...(currentRules ?? data?.rules ?? []), rule])
    setAddOpen(false)
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
      pushToast(ownerNeedsExpert ? t('Đã gửi chuyên gia duyệt. Luật đang chạy giữ nguyên tới khi được duyệt.') : t('Đã lưu luật phun sương theo thời tiết.'), 'success')
    } catch (error) {
      setSaveError(getErrorMessage(error))
    }
  }

  function decide(action: Promise<unknown>, doneMessage: string) {
    action
      .then(() => { pushToast(t(doneMessage), 'success'); setRejectingAt(null) })
      // 409: đề xuất vừa đổi hoặc đã có người xử lý, đóng ô để chuyên gia xem bản mới; lỗi khác giữ lý do đã gõ
      .catch(error => {
        pushToast(getErrorMessage(error), 'error')
        if ((error as { response?: { status?: number } }).response?.status === 409) setRejectingAt(null)
      })
  }

  // Đề xuất đang chờ của Farm Owner: chuyên gia duyệt hoặc từ chối, Farm Owner thấy mình đã gửi gì
  function renderProposal() {
    const proposal = data?.proposal
    if (!proposal) return null
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-climateOrange/30 bg-climateOrange/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-charcoal">
            {t('Đề xuất của chủ nhà yến đang chờ duyệt ({{n}} luật, gửi lúc {{time}})', { n: proposal.rules.length, time: formatDate(proposal.proposed_at) })}
          </p>
          {isExpert && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRejectingAt(proposal.proposed_at)} disabled={approve.isPending}>{t('Từ chối')}</Button>
              <Button size="sm" loading={approve.isPending} onClick={() => decide(approve.mutateAsync(proposal.proposed_at), 'Đã duyệt, luật mới có hiệu lực từ lần tính kế tiếp.')}>
                {t('Duyệt đề xuất')}
              </Button>
            </div>
          )}
        </div>
        {ownerNeedsExpert && <p className="text-small text-graphite">{t('Gửi lại bộ luật mới sẽ thay đề xuất này.')}</p>}
        <fieldset disabled className="divide-y divide-warmGray/10 rounded-xl bg-white px-4">
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
    // Không hiện hộp "chưa có bù" khi chưa có luật nào: EmptyState bên dưới đã đủ
    if (!rules.length) return null
    return (
      <p className="rounded-xl bg-warmGray/10 px-3.5 py-2.5 text-sm text-graphite">{t('Chưa có lần chỉnh nào kể từ khi lưu luật, hoặc dự báo chưa khớp luật nào.')}</p>
    )
  }

  function renderHeaderAction() {
    if (isLoading || isError) return undefined
    // Số luật hiện ngay cạnh nút Thêm; đủ 10 luật thì nút thay bằng chữ báo đã đạt tối đa
    const count = <span className="text-small text-warmGray">{t('{{n}}/{{max}} luật', { n: rules.length, max: MAX_RULES })}</span>
    if (!canEditParameters) return count
    return (
      <div className="flex items-center gap-3">
        {count}
        {rules.length >= MAX_RULES
          ? <Badge tone="warning">{t('Đã đạt tối đa 10 luật')}</Badge>
          : <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>{t('Thêm luật')}</Button>}
      </div>
    )
  }

  function renderRulesList() {
    if (isLoading) return <LoadingSkeleton count={3} className="h-12 w-full rounded-2xl" />
    if (rules.length === 0) {
      return (
        <EmptyState
          icon={<CloudRain className="w-8 h-8" />}
          title={t('Nhà này chưa có luật phun sương theo thời tiết.')}
          // Người chỉ xem (Kỹ thuật viên) không có nút Thêm luật nên không có câu hướng dẫn
          description={canEditParameters ? t('Bấm "Thêm luật" ở góc trên để thêm luật đầu tiên.') : undefined}
        />
      )
    }
    return (
      <div className="divide-y divide-warmGray/10 rounded-2xl border border-warmGray/15 px-4">
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
        title={t('Chọn nhà yến ở thanh trên để xem luật phun sương theo thời tiết')}
      />
    )
  }

  return (
    // Farm Owner soạn được; farm có chuyên gia thì nút lưu gửi đề xuất
    <fieldset disabled={!canEditParameters} className="contents">
    <div className="flex w-full flex-col gap-6">
      <SectionCard
        description={t('Tự chỉnh mức phun sương theo dự báo thời tiết')}
        help={t('Mỗi giờ hệ thống tự chọn luật khớp với dự báo thời tiết và điều chỉnh mức phun sương trong khoảng ±10%, hiệu lực tối đa 2 giờ. Khi nhiều luật khớp, áp luật có mức chỉnh lớn nhất.')}
        action={renderHeaderAction()}
      >
        <div className="flex flex-col gap-4">
          {/* Lỗi tải dữ liệu */}
          {isError && !isLoading && (
            <div className="flex items-start gap-2 rounded-xl bg-alertRed/10 px-3.5 py-2.5 text-sm text-alertRed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('Không tải được luật phun sương theo thời tiết. Thử lại.')}</span>
            </div>
          )}

          {/* Lần chỉnh gần nhất */}
          {renderLastCompensation()}

          {renderProposal()}

          {/* Danh sách luật: ẩn khi GET lỗi */}
          {!isError && renderRulesList()}
        </div>
      </SectionCard>

      {/* Modal thêm luật */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('Thêm luật phun sương theo thời tiết')}
        size="lg"
        closeOnBackdrop
      >
        <WeatherRuleAddForm onAdd={handleAdd} disabled={mutation.isPending} />
      </Modal>

      {saveError && (
        <div className="flex items-start gap-2 rounded-xl bg-alertRed/10 px-3.5 py-2.5 text-sm text-alertRed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {isDirty && (
        <div className="flex items-center justify-end gap-2">
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
      open={rejectingAt !== null}
      onClose={() => setRejectingAt(null)}
      title={t('Từ chối đề xuất luật phun sương theo thời tiết')}
      label={t('Lý do')}
      placeholder={t('VD: mùa này chưa cần phun thêm')}
      hint={t('Chủ nhà yến nhận lý do này. Luật đang chạy giữ nguyên.')}
      submitLabel={t('Từ chối')}
      required
      danger
      loading={reject.isPending}
      onSubmit={note => rejectingAt && decide(reject.mutateAsync({ note, proposedAt: rejectingAt }), 'Đã từ chối đề xuất.')}
    />
    </fieldset>
  )
}
