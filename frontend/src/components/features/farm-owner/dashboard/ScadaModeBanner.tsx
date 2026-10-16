import { useEffect, useState } from 'react'
import { Radio } from 'lucide-react'
import { Badge } from '@/components/ui'
import SelectMenu from '@/components/ui/SelectMenu'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { LIVE_MAX_AGE_MS } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import { cn } from '@/lib/cn'
import type { ControlMode } from '@/types'

interface HouseOption {
  value: string
  label: string
}

interface ScadaModeBannerProps {
  lastSyncedAt?: string
  controlMode?: ControlMode
  overrideExpiry?: string
  houseId: string
  houseOptions: HouseOption[]
  onHouseChange: (houseId: string) => void
}

// Thanh giám sát SCADA và chọn nhà yến
export default function ScadaModeBanner({ lastSyncedAt, controlMode, overrideExpiry, houseId, houseOptions, onHouseChange }: ScadaModeBannerProps) {
  const { t, ago, time } = useTranslation(dashboardDict)
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick(tick => tick + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const hasEverReceived = lastSyncedAt !== undefined
  const isLive = hasEverReceived && Date.now() - new Date(lastSyncedAt).getTime() <= LIVE_MAX_AGE_MS
  const modeLabel = controlMode ? t(`banner.mode.${controlMode}`) : ''
  const modeUntil = controlMode === 'MANUAL' && overrideExpiry ? ` · ${t('banner.modeUntil', { time: time(overrideExpiry) })}` : ''
  const plcLabel = isLive ? t('banner.plc.online') : hasEverReceived ? t('banner.plc.lost') : t('banner.plc.waiting')

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warmGray/15 bg-white px-4 py-3 shadow-card lg:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', isLive ? 'bg-success' : 'bg-warmGray')} />
        <span className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-[0.06em] text-charcoal">{t('banner.title')}</span>
        {modeLabel && <span className="shrink-0 text-warmGray/50">—</span>}
        {modeLabel && <p className="min-w-0 truncate text-[11px] font-medium text-warmGray" title={`${modeLabel}${modeUntil}`}>{modeLabel}{modeUntil}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SelectMenu ariaLabel={t('page.houseLabel')} value={houseId} options={houseOptions} onChange={onHouseChange} className="w-40 justify-between" />
        <Badge
          tone={isLive ? 'positive' : 'critical'}
          className={cn('w-[190px] justify-center whitespace-nowrap', !isLive && !hasEverReceived && 'bg-statusYellow/70 text-charcoal')}
        >
          <Radio width={12} height={12} />
          {plcLabel}
        </Badge>
        <span className="w-[160px] whitespace-nowrap pl-1 text-left text-xs text-warmGray">
          {lastSyncedAt ? t('banner.synced', { ago: ago(lastSyncedAt) }) : t('banner.notSynced')}
        </span>
      </div>
    </div>
  )
}
