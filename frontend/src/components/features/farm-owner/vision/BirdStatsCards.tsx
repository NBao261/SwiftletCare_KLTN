import { LogIn, LogOut, Repeat, type LucideIcon } from 'lucide-react'
import { Card, Badge } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useBirdCountTrends } from '@/hooks/farm-owner/useAnalytics'
import { formatReturnRate } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import type { BirdCountDailyRecord } from '@/apis/farm-owner/analytics.api'

interface BirdStatsCardsProps {
  zoneId: string
  /** true khi LiveCameraCard đang phóng to — 3 card xếp ngang bên dưới thay vì xếp dọc bên cạnh */
  horizontal?: boolean
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return +(((current - previous) / previous) * 100).toFixed(1)
}

// BirdStatsCards – Entry/Exit/Return rate ngày gần nhất — API thật (GET /analytics/bird-count/trends)
export default function BirdStatsCards({ zoneId, horizontal }: BirdStatsCardsProps) {
  const { data, isLoading } = useBirdCountTrends(zoneId, 7)

  if (isLoading) {
    return (
      <div className={cn(horizontal ? 'grid grid-cols-1 gap-4 sm:grid-cols-3' : 'flex flex-col gap-4')}>
        <LoadingSkeleton count={3} className="h-24 w-full" />
      </div>
    )
  }

  const records = data?.records ?? []
  const latest: BirdCountDailyRecord | undefined = records[records.length - 1]
  const previous = records[records.length - 2]

  const entryDelta = latest && previous ? percentDelta(latest.evening_entry, previous.evening_entry) : null
  const exitDelta = latest && previous ? percentDelta(latest.morning_exit, previous.morning_exit) : null

  return (
    <div className={cn(horizontal ? 'grid grid-cols-1 gap-4 sm:grid-cols-3' : 'flex flex-col gap-4')}>
      <StatCard
        icon={LogIn}
        label="Vào tổ hôm nay"
        hint="Lượt chim bay vào tổ"
        value={latest ? latest.evening_entry.toLocaleString('vi-VN') : '--'}
        unit="lượt"
        deltaPercent={entryDelta}
      />
      <StatCard
        icon={LogOut}
        label="Xuất đàn hôm nay"
        hint="Lượt chim xuất đàn"
        value={latest ? latest.morning_exit.toLocaleString('vi-VN') : '--'}
        unit="lượt"
        deltaPercent={exitDelta}
      />
      <ReturnRateCard
        icon={Repeat}
        returnRate={latest?.return_rate ?? null}
        isSignificantDrop={data?.is_significant_drop ?? false}
      />
    </div>
  )
}

function StatCard({
  icon: Icon, label, hint, value, unit, deltaPercent,
}: {
  icon: LucideIcon; label: string; hint: string; value: string; unit: string; deltaPercent: number | null
}) {
  return (
    <Card className="flex h-full flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-limeMist text-charcoal">
            <Icon width={16} height={16} />
          </span>
          <div>
            <p className="font-bold text-charcoal">{label}</p>
            <p className="text-xs text-warmGray">{hint}</p>
          </div>
        </div>
        {deltaPercent !== null && (
          <Badge tone={deltaPercent >= 0 ? 'positive' : 'critical'}>
            {deltaPercent >= 0 ? '+' : ''}{deltaPercent}% so với hôm qua
          </Badge>
        )}
      </div>
      <p className="mt-1 leading-none">
        <span className="text-3xl font-extrabold tracking-tight text-charcoal">{value}</span>
        <span className="ml-2 text-sm font-medium text-warmGray">{unit}</span>
      </p>
    </Card>
  )
}

function ReturnRateCard({
  icon: Icon, returnRate, isSignificantDrop,
}: {
  icon: LucideIcon; returnRate: number | null; isSignificantDrop: boolean
}) {
  const hasValue = returnRate !== null
  const percent = hasValue ? Math.min(100, Math.max(0, returnRate)) : 0

  return (
    <Card className="flex h-full flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-limeMist text-charcoal">
            <Icon width={16} height={16} />
          </span>
          <div>
            <p className="font-bold text-charcoal">Tỷ lệ về tổ</p>
            <p className="text-xs text-warmGray">Tỷ lệ chim về tổ so với lượt bay đi</p>
          </div>
        </div>
        {hasValue && (
          <Badge tone={isSignificantDrop ? 'critical' : 'positive'}>
            {isSignificantDrop ? 'Giảm bất thường' : 'Ổn định'}
          </Badge>
        )}
      </div>
      <p className="leading-none">
        <span className="text-3xl font-extrabold tracking-tight text-charcoal">
          {hasValue ? formatReturnRate(returnRate) : '--'}
        </span>
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-warmGray/10">
        <div
          className={cn('h-full rounded-full', isSignificantDrop ? 'bg-alertRed' : 'bg-success')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </Card>
  )
}
