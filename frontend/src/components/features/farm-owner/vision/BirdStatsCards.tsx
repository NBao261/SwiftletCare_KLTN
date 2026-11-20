import { ArrowDownIcon, ArrowUpIcon, RepeatIcon, SignInIcon, SignOutIcon, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Badge, Card } from '@/components/ui'
import { t } from '@/i18n'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useHousesBirdCountTrends } from '@/hooks/farm-owner/useAnalytics'
import { formatReturnRate } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import type { BirdCountDailyRecord } from '@/apis/farm-owner/analytics.api'
import { NO_VALUE } from '@/constants/display'

interface BirdStatsCardsProps {
  // 1 nhà, hoặc mọi nhà của farm khi lọc tất cả nhà yến (số đếm cộng theo ngày)
  houseIds: string[]
  /** true khi LiveCameraCard đang phóng to — 3 card xếp ngang bên dưới thay vì xếp dọc bên cạnh */
  horizontal?: boolean
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return +(((current - previous) / previous) * 100).toFixed(1)
}

// BirdStatsCards – Entry/Exit/Return rate ngày gần nhất — API thật (GET /analytics/bird-count/trends)
export default function BirdStatsCards({ houseIds, horizontal }: BirdStatsCardsProps) {
  const { records, single, isLoading } = useHousesBirdCountTrends(houseIds, 7)

  if (isLoading) {
    return (
      <div className={cn(horizontal ? 'grid grid-cols-1 gap-4 sm:grid-cols-3' : 'flex flex-col gap-4')}>
        <LoadingSkeleton count={3} className="h-24 w-full" />
      </div>
    )
  }

  const latest: BirdCountDailyRecord | undefined = records[records.length - 1]
  const previous = records[records.length - 2]

  const entryDelta = latest && previous ? percentDelta(latest.evening_entry, previous.evening_entry) : null
  const exitDelta = latest && previous ? percentDelta(latest.morning_exit, previous.morning_exit) : null

  return (
    <div className={cn(horizontal ? 'grid grid-cols-1 gap-4 sm:grid-cols-3' : 'flex flex-col gap-4')}>
      <StatCard
        icon={SignInIcon}
        label="Vào tổ hôm nay"
        hint="Lượt chim bay vào tổ"
        value={latest ? latest.evening_entry.toLocaleString('vi-VN') : NO_VALUE}
        unit="lượt"
        deltaPercent={entryDelta}
      />
      <StatCard
        icon={SignOutIcon}
        label="Xuất đàn hôm nay"
        hint="Lượt chim xuất đàn"
        value={latest ? latest.morning_exit.toLocaleString('vi-VN') : NO_VALUE}
        unit="lượt"
        deltaPercent={exitDelta}
      />
      <ReturnRateCard
        icon={RepeatIcon}
        returnRate={latest?.return_rate ?? null}
        isSignificantDrop={single?.is_significant_drop ?? false}
      />
    </div>
  )
}

function StatCard({
  icon: Icon, label, hint, value, unit, deltaPercent,
}: {
  icon: PhosphorIcon; label: string; hint: string; value: string; unit: string; deltaPercent: number | null
}) {
  return (
    <Card className="flex h-full flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-charcoal">
            <Icon width={16} height={16} />
          </span>
          <div>
            <p className="font-bold text-charcoal">{label}</p>
            <p className="text-xs text-warmGray">{hint}</p>
          </div>
        </div>
      </div>
      <p className="mt-1 leading-none">
        <span className="text-3xl font-extrabold tracking-tight text-charcoal">{value}</span>
        <span className="ml-2 text-sm font-medium text-warmGray">{unit}</span>
      </p>
      {/* So với hôm qua: dòng phụ dưới số (FO-05); 0 % màu trung tính, tăng/giảm kèm mũi tên chứ không chỉ màu (CH-05) */}
      {deltaPercent !== null && (
        <p className="mt-1 flex items-center gap-1 text-small font-medium text-warmGray">
          {deltaPercent > 0 && <ArrowUpIcon size={14} weight="bold" className="text-accent-800" aria-hidden="true" />}
          {deltaPercent < 0 && <ArrowDownIcon size={14} weight="bold" className="text-safetyOrange" aria-hidden="true" />}
          <span className={cn('tabular-nums', deltaPercent > 0 && 'text-accent-800', deltaPercent < 0 && 'text-safetyOrange')}>
            {deltaPercent > 0 ? '+' : ''}{deltaPercent} %
          </span>
          {t('so với hôm qua')}
        </p>
      )}
    </Card>
  )
}

function ReturnRateCard({
  icon: Icon, returnRate, isSignificantDrop,
}: {
  icon: PhosphorIcon; returnRate: number | null; isSignificantDrop: boolean
}) {
  const hasValue = returnRate !== null
  const percent = hasValue ? Math.min(100, Math.max(0, returnRate)) : 0

  return (
    <Card className="flex h-full flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-charcoal">
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
          {hasValue ? formatReturnRate(returnRate) : NO_VALUE}
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
