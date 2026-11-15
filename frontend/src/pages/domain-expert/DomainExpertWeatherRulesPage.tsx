// ENV-FR-028…030, BR-38: Chuyên gia đặt tối đa 10 luật cho từng nhà (Farm Owner khi không có chuyên gia, BR-22)
import { useState, useEffect } from 'react'
import { CloudRain, Info, Zap, AlertTriangle } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { useZoneStore } from '@/stores/zoneStore'
import { useToastStore } from '@/stores/toastStore'
import { useWeatherRules, useUpdateWeatherRules } from '@/hooks/domain-expert/useWeatherRules'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import type { WeatherRule } from '@/types/expert.types'
import WeatherRuleRow from '@/components/features/domain-expert/weather/WeatherRuleRow'
import WeatherRuleAddForm from '@/components/features/domain-expert/weather/WeatherRuleAddForm'
import { formatDate } from '@/lib/helpers'

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
          Lần bù gần nhất: <span className="text-charcoal">{sign}{data.offset_pct}% phun</span>
          <span className="ml-2 font-normal text-infoBlue/80">trong {formatDate(data.sent_at)}</span>
        </p>
        <p className="text-infoBlue/80">
          Hết hạn lúc {formatDate(data.expires_at)}
          {forecast.temperature_max !== null && <> · Nhiệt: {forecast.temperature_max}°C</>}
          {forecast.humidity_max !== null && <> · Độ ẩm: {forecast.humidity_max}%</>}
          {forecast.rain_mm !== null && <> · Mưa: {forecast.rain_mm} mm</>}
        </p>
      </div>
    </div>
  )
}

export default function DomainExpertWeatherRulesPage() {
  const { selectedHouseId } = useZoneStore()
  const { data, isLoading, isError } = useWeatherRules(selectedHouseId ?? undefined)
  const mutation = useUpdateWeatherRules(selectedHouseId ?? undefined)
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
      pushToast('Đã lưu luật bù thời tiết.', 'success')
    } catch (error) {
      setSaveError(getErrorMessage(error))
    }
  }

  function handleDiscard() {
    setLocalRules(null)
    setSaveError(null)
  }

  function renderLastCompensation() {
    if (isLoading) return <LoadingSkeleton count={1} className="h-14 w-full rounded-2xl" />
    if (isError) return null
    if (data?.last_compensation) return <LastCompensationBadge data={data.last_compensation} />
    return (
      <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-warmGray/5 border border-warmGray/15 text-sm text-warmGray">
        <Info className="w-4 h-4 shrink-0" />
        <span>Chưa có lần bù nào kể từ khi luật được lưu (hoặc chưa có luật nào thoả dự báo).</span>
      </div>
    )
  }

  function renderRulesList() {
    if (isLoading) return <LoadingSkeleton count={3} className="h-12 w-full rounded-2xl" />
    if (rules.length === 0) {
      return (
        <EmptyState
          icon={<CloudRain className="w-8 h-8" />}
          title="Chưa có luật nào. Thêm luật đầu tiên bên dưới."
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
        title="Chọn nhà yến ở thanh trên để xem luật bù thời tiết"
      />
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-charcoal">Luật bù phun sương theo thời tiết</h1>
        <p className="mt-0.5 text-sm text-warmGray">
          ENV-FR-028…030, BR-38 — Job mỗi giờ chọn luật có |bù| lớn nhất và gửi xuống controller (tối đa ±10%, 2 giờ)
        </p>
      </div>

      {/* Lỗi tải dữ liệu */}
      {isError && !isLoading && (
        <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-alertRed/5 border border-alertRed/20 text-sm text-alertRed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Không thể tải luật bù thời tiết. Vui lòng thử lại.</span>
        </div>
      )}

      {/* Lần bù gần nhất */}
      {renderLastCompensation()}

      {/* Danh sách luật hiện tại */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal">Danh sách luật ({rules.length}/{MAX_RULES})</h2>
          {rules.length >= MAX_RULES && (
            <span className="text-xs text-charcoal bg-statusYellow/10 border border-statusYellow/40 px-2 py-0.5 rounded-full font-semibold">
              Đã đạt tối đa 10 luật
            </span>
          )}
        </div>

        {renderRulesList()}
      </div>

      {/* Form thêm luật mới — ẩn khi đang tải hoặc GET lỗi */}
      {!isLoading && !isError && rules.length < MAX_RULES && (
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
            Huỷ thay đổi
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={mutation.isPending}
          >
            Lưu luật
          </Button>
        </div>
      )}
    </div>
  )
}
