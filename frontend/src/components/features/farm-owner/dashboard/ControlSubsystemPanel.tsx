import { DropIcon, SpeakerHighIcon, WindIcon } from '@phosphor-icons/react'
import { Badge, Card, RadialGauge } from '@/components/ui'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { NO_VALUE } from '@/constants/display'
import { cn } from '@/lib/cn'
import type { DashboardRelayStates } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import type { ControlMode, ControlOutput } from '@/types'

// 3 relay: phun sương, quạt, loa (không có relay sưởi)
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
}

// Trạng thái 3 relay của Zone, chỉ xem; phun sương/quạt hiện % công suất logic mờ khi có telemetry live
export default function ControlSubsystemPanel({ zoneName, relayStates, controlMode, controlOutput, tooHot }: ControlSubsystemPanelProps) {
  const { t } = useTranslation(dashboardDict)

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h2 text-charcoal">{t('control.title')}</h2>
          <p className="mt-1 text-sm text-warmGray">
            {zoneName ? t('control.subtitleZone', { zone: zoneName }) : t('control.subtitle')}
          </p>
        </div>
        {controlMode && (
          <Badge tone={controlMode === 'AUTO' ? 'info' : 'warning'}>
            {t(controlMode === 'AUTO' ? 'scada.modeAuto' : 'scada.modeManual')}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {RELAY_ITEMS.map(item => (
          <RelayTile
            key={item.key}
            item={item}
            relayStates={relayStates}
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
  fuzzyPercent?: number
  isAnomaly: boolean
}

// 1 ô relay: vòng công suất bên trái, tên + BẬT/TẮT bên phải, dòng dưới là cảnh báo nhiệt hoặc công suất
function RelayTile({ item, relayStates, fuzzyPercent, isAnomaly }: RelayTileProps) {
  const { t } = useTranslation(dashboardDict)
  const Icon = item.icon
  // Relay thiếu trong dữ liệu thì xem như chưa có dữ liệu, không báo TẮT sai
  const hasData = relayStates?.[item.key] !== undefined
  const isOn = relayStates?.[item.key] ?? false
  const hasFuzzy = hasData && fuzzyPercent !== undefined

  let tone: RelayTone = 'unknown'
  if (hasData) tone = isAnomaly ? 'anomaly' : isOn ? 'on' : 'off'

  let gaugePercent = 0
  if (hasFuzzy) gaugePercent = fuzzyPercent
  else if (isOn) gaugePercent = 100

  let stateText: string = NO_VALUE
  if (hasData) stateText = isOn ? t('relay.on') : t('relay.off')

  let footer = ''
  if (isAnomaly) footer = t('control.tooHot')
  else if (hasFuzzy) footer = t('control.output', { percent: fuzzyPercent })

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-warmGray/15 p-4">
      <RadialGauge percent={gaugePercent} size={60} strokeWidth={6} trackClassName="stroke-warmGray/10" className={GAUGE_CLASS[tone]}>
        <Icon width={20} height={20} className={ICON_CLASS[tone]} />
      </RadialGauge>
      <div className="min-w-0">
        <p className="label-caption truncate">{t(item.labelKey)}</p>
        <p className={cn('text-xl font-extrabold leading-tight', hasData ? 'text-charcoal' : 'text-warmGray')}>{stateText}</p>
        {footer && <p className={cn('text-small font-medium', isAnomaly ? 'text-climateOrange' : 'text-warmGray')}>{footer}</p>}
      </div>
    </div>
  )
}
