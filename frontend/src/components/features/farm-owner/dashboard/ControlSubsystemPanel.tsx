import type { ReactNode } from 'react'
import { DropIcon, SpeakerHighIcon, WindIcon } from '@phosphor-icons/react'
import { Button, Card, RadialGauge } from '@/components/ui'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { cn } from '@/lib/cn'
import type { DashboardRelayStates } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import type { ControlMode, ControlOutput } from '@/types'

// 3 relay: phun sương, loa, quạt (Report 3 §8: không có relay sưởi)
const RELAY_ITEMS = [
  { key: 'misting', labelKey: 'relay.misting', icon: DropIcon },
  { key: 'ventilation', labelKey: 'relay.ventilation', icon: WindIcon },
  { key: 'speaker', labelKey: 'relay.speaker', icon: SpeakerHighIcon },
] as const

type RelayItem = (typeof RELAY_ITEMS)[number]
type RelayTone = 'unknown' | 'anomaly' | 'on' | 'off'

const GAUGE_CLASS: Record<RelayTone, string> = {
  unknown: 'stroke-warmGray/20',
  anomaly: 'stroke-climateOrange',
  on: 'stroke-success',
  off: 'stroke-warmGray/25',
}

const ICON_CLASS: Record<RelayTone, string> = {
  unknown: 'text-warmGray',
  anomaly: 'text-climateOrange',
  on: 'text-success',
  off: 'text-warmGray',
}

interface ControlSubsystemPanelProps {
  zoneName?: string
  relayStates?: DashboardRelayStates
  controlMode?: ControlMode
  controlOutput?: ControlOutput
  tooHot?: boolean
  // Ô chọn Zone + nút đồng bộ đặt ở góc phải header
  scopeControl?: ReactNode
  // Đang đồng bộ Zone với khung Cảm biến: viền nổi để thấy 2 khung đang đi cùng nhau
  isLinked?: boolean
  // Mở trang chi tiết SCADA; không truyền (role không được điều khiển relay) thì ẩn nút
  onOpenDetail?: () => void
}

// Trạng thái relay phân hệ điều khiển, phun sương/quạt hiện % công suất logic mờ khi có telemetry live
export default function ControlSubsystemPanel({ zoneName, relayStates, controlMode, controlOutput, tooHot, scopeControl, isLinked = false, onOpenDetail }: ControlSubsystemPanelProps) {
  const { t } = useTranslation(dashboardDict)

  return (
    <Card size="lg" className={cn('flex h-full flex-col gap-5 transition-shadow duration-300', isLinked && 'ring-2 ring-charcoal/25')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h2 text-charcoal">{t('control.title')}</h2>
          <p className="mt-1 text-sm text-warmGray">
            {zoneName ? t('control.subtitleZone', { zone: zoneName }) : t('control.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scopeControl}
          {onOpenDetail && (
            <Button variant="secondary" size="sm" onClick={onOpenDetail}>
              {t('control.detail')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
        {RELAY_ITEMS.map(item => (
          <RelayTile
            key={item.key}
            item={item}
            relayStates={relayStates}
            controlMode={controlMode}
            fuzzyPercent={item.key === 'misting' || item.key === 'ventilation' ? controlOutput?.[item.key] : undefined}
            isAnomaly={item.key === 'ventilation' && !!tooHot}
          />
        ))}
      </div>
    </Card>
  )
}

interface RelayTileProps {
  item: RelayItem
  relayStates?: DashboardRelayStates
  controlMode?: ControlMode
  fuzzyPercent?: number
  isAnomaly: boolean
}

// 1 ô relay: gauge BẬT/TẮT hoặc % logic mờ, dòng dưới là cảnh báo nhiệt hoặc chế độ chạy
function RelayTile({ item, relayStates, controlMode, fuzzyPercent, isAnomaly }: RelayTileProps) {
  const { t } = useTranslation(dashboardDict)
  const Icon = item.icon
  // Relay thiếu trong dữ liệu thì xem như chưa có dữ liệu, không báo TẮT sai
  const hasData = relayStates?.[item.key] !== undefined
  const isOn = relayStates?.[item.key] ?? false
  const hasFuzzy = hasData && fuzzyPercent !== undefined
  const stateLabel = isOn ? t('relay.on') : t('relay.off')

  let tone: RelayTone = 'unknown'
  if (hasData) tone = isAnomaly ? 'anomaly' : isOn ? 'on' : 'off'

  let gaugePercent = 0
  if (hasFuzzy) gaugePercent = fuzzyPercent
  else if (isOn) gaugePercent = 100

  let gaugeLabel = '_'
  if (hasFuzzy) gaugeLabel = `${fuzzyPercent}%`
  else if (hasData) gaugeLabel = stateLabel

  let footer = '_'
  if (isAnomaly) footer = t('control.tooHot')
  else if (hasFuzzy && controlMode === 'AUTO') footer = t('control.fuzzy', { state: stateLabel })
  else if (controlMode) footer = t('control.mode', { mode: controlMode })

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-warmGray/15 p-4 text-center">
      <RadialGauge percent={gaugePercent} size={88} strokeWidth={7} trackClassName="stroke-warmGray/10" className={GAUGE_CLASS[tone]}>
        <div className="flex flex-col items-center gap-0.5">
          <Icon width={18} height={18} className={ICON_CLASS[tone]} />
          <span className="text-xs font-extrabold text-charcoal">{gaugeLabel}</span>
        </div>
      </RadialGauge>
      <p className="label-caption leading-tight">{t(item.labelKey)}</p>
      <p className={cn('text-xs font-semibold', isAnomaly ? 'text-climateOrange' : 'text-warmGray')}>{footer}</p>
    </div>
  )
}
