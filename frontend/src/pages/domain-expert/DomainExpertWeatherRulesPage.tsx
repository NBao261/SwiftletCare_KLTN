/**
 * DomainExpertWeatherRulesPage — Màn luật bù phun sương theo thời tiết
 * ENV-FR-028…030, BR-38: Chuyên gia đặt tối đa 10 luật cho từng nhà.
 * Farm Owner được đặt khi farm chưa có chuyên gia (BR-22, gate bằng backend 403).
 */
import { useState } from 'react'
import { CloudRain, Info, Zap, AlertTriangle } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { useZoneStore } from '@/stores/zoneStore'
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
  const fc = data.forecast
  return (
    <div className="flex flex-wrap items-start gap-3 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-sm">
      <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
      <div className="space-y-0.5 min-w-0">
        <p className="font-semibold text-blue-800">
          Lần bù gần nhất: <span className="text-blue-900">{sign}{data.offset_pct}% phun</span>
          <span className="ml-2 font-normal text-blue-700">trong {formatDate(data.sent_at)}</span>
        </p>
        <p className="text-blue-700">
          Hết hạn lúc {formatDate(data.expires_at)}
          {fc.temperature_max !== null && <> · Nhiệt: {fc.temperature_max}°C</>}
          {fc.humidity_max !== null && <> · Độ ẩm: {fc.humidity_max}%</>}
          {fc.rain_mm !== null && <> · Mưa: {fc.rain_mm} mm</>}
        </p>
      </div>
    </div>
  )
}

export default function DomainExpertWeatherRulesPage() {
  const { selectedHouseId } = useZoneStore()
  const { data, isLoading } = useWeatherRules(selectedHouseId ?? undefined)
  const mutation = useUpdateWeatherRules(selectedHouseId ?? undefined)
  const getErrorMessage = useApiErrorMessage()

  const [localRules, setLocalRules] = useState<WeatherRule[] | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Dùng localRules khi người dùng đang chỉnh, ngược lại dùng từ server
  const rules: WeatherRule[] = localRules ?? data?.rules ?? []
  const isDirty = localRules !== null

  function handleAdd(rule: WeatherRule) {
    setLocalRules(prev => [...(prev ?? data?.rules ?? []), rule])
    setSaveSuccess(false)
  }

  function handleRemove(index: number) {
    setLocalRules(prev => {
      const base = prev ?? data?.rules ?? []
      return base.filter((_, i) => i !== index)
    })
    setSaveSuccess(false)
  }

  function handleToggle(index: number) {
    setLocalRules(prev => {
      const base = prev ?? data?.rules ?? []
      return base.map((r, i) => i === index ? { ...r, active: !r.active } : r)
    })
    setSaveSuccess(false)
  }

  async function handleSave() {
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await mutation.mutateAsync(rules)
      setLocalRules(null)
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(getErrorMessage(err))
    }
  }

  function handleDiscard() {
    setLocalRules(null)
    setSaveError(null)
    setSaveSuccess(false)
  }

  if (!selectedHouseId) {
    return (
      <EmptyState
        icon={<CloudRain className="w-10 h-10" />}
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

      {/* Lần bù gần nhất */}
      {isLoading ? (
        <LoadingSkeleton count={1} className="h-14 w-full rounded-2xl" />
      ) : data?.last_compensation ? (
        <LastCompensationBadge data={data.last_compensation} />
      ) : (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-warmGray/5 border border-warmGray/15 text-sm text-warmGray">
          <Info className="w-4 h-4 shrink-0" />
          <span>Chưa có lần bù nào kể từ khi luật được lưu (hoặc chưa có luật nào thoả dự báo).</span>
        </div>
      )}

      {/* Danh sách luật hiện tại */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal">Danh sách luật ({rules.length}/{MAX_RULES})</h2>
          {rules.length >= MAX_RULES && (
            <span className="text-xs text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full font-semibold">
              Đã đạt tối đa 10 luật
            </span>
          )}
        </div>

        {isLoading ? (
          <LoadingSkeleton count={3} className="h-12 w-full rounded-2xl" />
        ) : rules.length === 0 ? (
          <EmptyState
            icon={<CloudRain className="w-8 h-8" />}
            title="Chưa có luật nào. Thêm luật đầu tiên bên dưới."
          />
        ) : (
          <div className="space-y-1.5">
            {rules.map((rule, idx) => (
              <WeatherRuleRow
                key={rule._id ?? idx}
                rule={rule}
                onToggle={() => handleToggle(idx)}
                onRemove={() => handleRemove(idx)}
                disabled={mutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form thêm luật mới */}
      {rules.length < MAX_RULES && (
        <WeatherRuleAddForm onAdd={handleAdd} disabled={mutation.isPending} />
      )}

      {saveError && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-alertRed/5 border border-alertRed/20 text-sm text-alertRed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {(isDirty || saveSuccess) && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-warmGray/10">
          <div>
            {saveSuccess && !isDirty && (
              <span className="text-sm text-green-700 font-medium">Đã lưu luật thành công.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button variant="secondary" size="sm" onClick={handleDiscard} disabled={mutation.isPending}>
                Huỷ thay đổi
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty}
              loading={mutation.isPending}
            >
              Lưu luật
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
