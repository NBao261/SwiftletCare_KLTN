import { useState, useEffect, useRef, type ComponentType, type SVGProps } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict, type DashboardKey } from '@/constants/dashboard.i18n'
import { cn } from '@/lib/cn'

export interface Reading {
  key: string
  labelKey: DashboardKey
  value: number | undefined
  unit: string
  decimals: number
  icon: ComponentType<SVGProps<SVGSVGElement>>
  range: string
  isAnomaly: boolean
  mockReason?: string
  trend?: 'up' | 'down' | 'steady'
}

interface Props {
  reading: Reading
  isLoading: boolean
  isActive: boolean
}

const ICON_CLASS = {
  anomaly: 'bg-climateOrange text-white',
  safe: 'bg-warmGray/10 text-success',
  idle: 'bg-warmGray/10 text-charcoal',
}

function TrendBadge({ trend }: { trend?: 'up' | 'down' | 'steady' }) {
  if (!trend || trend === 'steady') return null
  if (trend === 'up') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60 whitespace-nowrap shrink-0 transition-all duration-300"
        title="Xu hướng tăng so với chu kỳ đo trước"
      >
        <TrendingUp className="h-3 w-3 stroke-[2.5] shrink-0" />
        <span>Tăng</span>
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200/60 whitespace-nowrap shrink-0 transition-all duration-300"
        title="Xu hướng giảm so với chu kỳ đo trước"
      >
        <TrendingDown className="h-3 w-3 stroke-[2.5] shrink-0" />
        <span>Giảm</span>
      </span>
    )
  }
  return null
}

export default function ExpertSensorTile({ reading, isLoading, isActive }: Props) {
  const { t, num } = useTranslation(dashboardDict)
  const { labelKey, value, unit, decimals, icon: Icon, range, isAnomaly, mockReason, key, trend } = reading
  const hasValue = !isLoading && value !== undefined && !Number.isNaN(value)
  const isOnlineAnomaly = isActive && isAnomaly
  const isSafe = isActive && hasValue && !isOnlineAnomaly
  const iconTone = isOnlineAnomaly ? 'anomaly' : isSafe ? 'safe' : 'idle'

  const prevValueRef = useRef<number | undefined>(undefined)
  const [activeTrend, setActiveTrend] = useState<'up' | 'down' | 'steady' | undefined>(trend)
  const [flashType, setFlashType] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (value === undefined || Number.isNaN(value)) {
      prevValueRef.current = undefined
      setActiveTrend(trend)
      return
    }

    if (prevValueRef.current !== undefined) {
      const diff = value - prevValueRef.current
      const epsilon = decimals === 0 ? 0.5 : 0.05
      if (Math.abs(diff) >= epsilon) {
        const nextTrend = diff > 0 ? 'up' : 'down'
        setActiveTrend(nextTrend)
        setFlashType(nextTrend)
        const timer = setTimeout(() => setFlashType(null), 1200)
        prevValueRef.current = value
        return () => clearTimeout(timer)
      }
    } else {
      prevValueRef.current = value
      setActiveTrend(trend ?? 'steady')
    }
  }, [value, decimals, trend])

  const bottomText = (() => {
    if (hasValue && isOnlineAnomaly) return t('env.outOfRange')
    if (hasValue && isSafe) {
      if (key === 'sound') return '✓ Mức nền ổn định'
      return t('env.safe', { range })
    }
    return `Ngưỡng: ${range}`
  })()

  return (
    <div
      className={cn(
        'rounded-2xl border p-3 2xl:p-3.5 transition-all duration-300',
        isOnlineAnomaly
          ? 'border-climateOrange/40 bg-climateOrange/[0.06] shadow-sm'
          : flashType === 'up'
            ? 'border-amber-300 bg-amber-50/20 ring-2 ring-amber-100'
            : flashType === 'down'
              ? 'border-sky-300 bg-sky-50/20 ring-2 ring-sky-100'
              : 'border-warmGray/15 bg-white hover:border-warmGray/30',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className="label-caption truncate">{t(labelKey)}</span>
          {mockReason && <MockDataTooltip reason={mockReason} />}
        </div>
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
            ICON_CLASS[iconTone],
          )}
        >
          <Icon width={14} height={14} />
        </span>
      </div>

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-baseline gap-1 min-w-0">
          <span
            className={cn(
              'text-2xl font-extrabold leading-none tracking-tight transition-colors duration-300',
              !hasValue ? 'text-warmGray' : isOnlineAnomaly ? 'text-climateOrange' : 'text-charcoal',
            )}
          >
            {hasValue ? num(value, decimals) : '—'}
          </span>
          <span className="text-xs font-semibold text-warmGray shrink-0">{unit}</span>
        </div>
        {hasValue && <TrendBadge trend={activeTrend} />}
      </div>

      <p className="mt-2 truncate text-[11px] font-medium text-warmGray" title={bottomText}>
        {bottomText}
      </p>
    </div>
  )
}
