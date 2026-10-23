import { Droplets, Wind, Volume2 } from 'lucide-react'
import { Card, RadialGauge } from '@/components/ui'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { cn } from '@/lib/cn'
import type { ControlMode, ControlOutput } from '@/types'

const RELAY_ITEMS = [
  { key: 'misting', labelKey: 'relay.misting', icon: Droplets },
  { key: 'ventilation', labelKey: 'relay.ventilation', icon: Wind },
  { key: 'speaker', labelKey: 'relay.speaker', icon: Volume2 },
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

export type ExpertRelayStates = { misting: boolean; speaker: boolean; ventilation: boolean; heating?: boolean }

interface Props {
  zoneName?: string
  relayStates?: ExpertRelayStates
  controlMode?: ControlMode
  controlOutput?: ControlOutput
  tooHot?: boolean
}

/**
 * ExpertControlPanel — Phân hệ điều khiển vi khí hậu Chuyên gia (Chế độ chỉ đọc)
 * Dành riêng cho phân hệ DOMAIN_EXPERT (SRS v2.1.4, EXPERT-FR-001)
 * 3 phân hệ SVG circular ring (phun sương, thông gió, âm thanh) + chu kỳ 120s
 */
export default function ExpertControlPanel({
  zoneName, relayStates, controlMode, controlOutput, tooHot,
}: Props) {
  const { t } = useTranslation(dashboardDict)
  const isMock = !controlOutput || (controlOutput.misting === undefined && controlOutput.ventilation === undefined)

  return (
    <Card size="lg" className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 text-charcoal">{t('control.title')}</h2>
          <p className="mt-1 text-sm text-warmGray">
            {zoneName ? t('control.subtitleZone', { zone: zoneName }) : t('control.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-warmGray/20 bg-warmGray/10 px-3 py-1 text-xs font-semibold text-graphite">
            Chế độ chỉ đọc
          </span>
          {isMock && (
            <MockDataTooltip reason="Gói tin Telemetry hiện tại trong DB chưa có thông số % chu kỳ điều khiển mờ thực tế từ thiết bị ESP32." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {RELAY_ITEMS.map(item => (
          <RelayTile
            key={item.key}
            item={item}
            relayStates={relayStates}
            controlMode={controlMode}
            fuzzyPercent={item.key === 'misting' || item.key === 'ventilation' ? controlOutput?.[item.key] : undefined}
            isAnomaly={item.key === 'ventilation' && !!tooHot}
            isMock={isMock}
          />
        ))}
      </div>

      <div className="border-t border-warmGray/10 pt-3 text-center text-xs font-medium text-warmGray">
        Chu kỳ điều khiển mờ (Fuzzy Logic cycle): 120 giây
      </div>
    </Card>
  )
}

interface RelayTileProps {
  item: RelayItem
  relayStates?: ExpertRelayStates
  controlMode?: ControlMode
  fuzzyPercent?: number
  isAnomaly: boolean
  isMock: boolean
}

function RelayTile({ item, relayStates, controlMode, fuzzyPercent, isAnomaly, isMock }: RelayTileProps) {
  const { t } = useTranslation(dashboardDict)
  const Icon = item.icon
  const hasData = relayStates !== undefined && !isMock
  const isOn = relayStates?.[item.key] ?? false
  const hasFuzzy = hasData && fuzzyPercent !== undefined
  const stateLabel = isOn ? t('relay.on') : t('relay.off')

  let tone: RelayTone = isAnomaly ? 'anomaly' : isOn ? 'on' : 'off'
  let gaugePercent = 0
  let gaugeLabel = '—'
  let footer = '—'

  if (isMock) {
    if (item.key === 'misting') {
      gaugePercent = 45; gaugeLabel = '45%'; tone = 'on'; footer = 'Chế độ AUTO'
    } else if (item.key === 'ventilation') {
      gaugePercent = 0; gaugeLabel = '0%'; tone = 'off'; footer = 'Chế độ AUTO'
    } else {
      gaugePercent = 0; gaugeLabel = 'Đang tắt'; tone = 'off'; footer = 'Lịch 05:00–07:00'
    }
  } else {
    if (hasFuzzy) {
      gaugePercent = fuzzyPercent; gaugeLabel = `${fuzzyPercent}%`
    } else if (hasData) {
      gaugePercent = isOn ? 100 : 0; gaugeLabel = stateLabel
    }
    if (isAnomaly) footer = t('control.tooHot')
    else if (hasFuzzy && controlMode === 'AUTO') footer = t('control.fuzzy', { state: stateLabel })
    else if (controlMode) footer = t('control.mode', { mode: controlMode })
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-warmGray/15 p-3.5 text-center bg-white shadow-sm">
      <RadialGauge percent={gaugePercent} size={76} strokeWidth={7} trackClassName="stroke-warmGray/10" className={GAUGE_CLASS[tone]}>
        <div className="flex flex-col items-center gap-0.5">
          <Icon width={16} height={16} className={ICON_CLASS[tone]} />
          <span className="text-[11px] font-extrabold text-charcoal">{gaugeLabel}</span>
        </div>
      </RadialGauge>
      <div className="flex items-center gap-1">
        <p className="label-caption leading-tight">{t(item.labelKey)}</p>
        {isMock && (
          <MockDataTooltip reason="Gói tin Telemetry hiện tại trong DB chưa có thông số % chu kỳ điều khiển mờ thực tế từ thiết bị ESP32." />
        )}
      </div>
      <p className={cn('text-xs font-semibold', isAnomaly ? 'text-climateOrange' : 'text-warmGray')}>{footer}</p>
    </div>
  )
}
