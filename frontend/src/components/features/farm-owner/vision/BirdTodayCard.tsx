import { ArrowDownIcon, ArrowUpIcon, MoonStarsIcon, RepeatIcon, SunHorizonIcon, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Badge, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { birdFlowDict } from '@/constants/birdFlow.i18n'
import { NO_VALUE } from '@/constants/display'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useHousesBirdCountTrends } from '@/hooks/farm-owner/useAnalytics'
import { cn } from '@/lib/cn'

// Số ngày lấy để so với hôm qua và tính trung bình
const TREND_DAYS = 7

interface BirdTodayCardProps {
  // 1 nhà, hoặc mọi nhà của trang trại khi chọn tất cả (số đếm cộng theo ngày)
  houseIds: string[]
  houseName: string
  // Ba số xếp ngang (camera đang phóng to hoặc chưa chọn nhà) thay vì xếp dọc cạnh camera
  horizontal?: boolean
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return +(((current - previous) / previous) * 100).toFixed(1)
}

// Số đếm của ngày gần nhất: chim ra buổi sáng, chim về buổi chiều và tỷ lệ chim về
export default function BirdTodayCard({ houseIds, houseName, horizontal = false }: BirdTodayCardProps) {
  const { t, num } = useTranslation(birdFlowDict)
  const { records, single, isLoading } = useHousesBirdCountTrends(houseIds, TREND_DAYS)

  const latest = records[records.length - 1]
  const previous = records[records.length - 2]
  // Ngày thiếu một buổi thì số buổi đó chưa đáng tin: ghi "_" và nói rõ buổi nào chưa có
  const hasMorning = latest !== undefined && latest.has_morning !== false
  const hasEvening = latest !== undefined && latest.has_evening !== false
  const exitDelta = hasMorning && previous ? percentDelta(latest.morning_exit, previous.morning_exit) : null
  const entryDelta = hasEvening && previous ? percentDelta(latest.evening_entry, previous.evening_entry) : null

  const rates = records.flatMap(record => (record.return_rate === null ? [] : [record.return_rate]))
  const averageRate = single?.avg_return_rate ?? (rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : null)

  return (
    <Card size="lg" className="flex h-full flex-col gap-5">
      <div>
        <h2 className="text-h2 text-charcoal">{t('today.title')}</h2>
        <p className="mt-1 text-sm text-warmGray">{houseName ? t('today.scopeHouse', { house: houseName }) : t('today.scopeAll')}</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={3} className="h-24 w-full" />
      ) : (
        <div className={cn('grid flex-1 grid-cols-1 gap-5', horizontal && 'md:grid-cols-3')}>
          <Metric
            icon={SunHorizonIcon}
            label={t('today.exit')}
            hint={t('today.exitHint')}
            value={hasMorning ? num(latest.morning_exit) : NO_VALUE}
            unit={t('today.unit')}
            deltaPercent={exitDelta}
            missing={latest && !hasMorning ? t('today.noMorning') : undefined}
            horizontal={horizontal}
          />
          <Metric
            icon={MoonStarsIcon}
            label={t('today.entry')}
            hint={t('today.entryHint')}
            value={hasEvening ? num(latest.evening_entry) : NO_VALUE}
            unit={t('today.unit')}
            deltaPercent={entryDelta}
            missing={latest && !hasEvening ? t('today.noEvening') : undefined}
            horizontal={horizontal}
          />
          <RateMetric
            rate={latest?.return_rate ?? null}
            averageRate={averageRate}
            isDrop={single?.is_significant_drop ?? false}
            dropDetail={single?.is_significant_drop && single.drop_percent !== null ? t('today.dropDetail', { n: num(single.drop_percent, 1), limit: num(single.drop_threshold_pct, 0) }) : undefined}
            horizontal={horizontal}
          />
        </div>
      )}
    </Card>
  )
}

// Mỗi chỉ số cách nhau bằng đường kẻ mảnh: ngang khi xếp dọc, dọc khi xếp ngang
function sectionClass(horizontal: boolean): string {
  return cn(
    'flex flex-col gap-1.5 border-t border-warmGray/15 pt-5 first:border-t-0 first:pt-0',
    horizontal && 'md:border-l md:border-t-0 md:pl-5 md:pt-0 md:first:border-l-0 md:first:pl-0',
  )
}

function Heading({ icon: Icon, label, hint }: { icon: PhosphorIcon; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-graphite">
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-bold text-charcoal">{label}</p>
        <p className="text-small text-warmGray">{hint}</p>
      </div>
    </div>
  )
}

function Metric({ icon, label, hint, value, unit, deltaPercent, missing, horizontal }: {
  icon: PhosphorIcon; label: string; hint: string; value: string; unit: string
  deltaPercent: number | null; missing?: string; horizontal: boolean
}) {
  const { t, num } = useTranslation(birdFlowDict)
  return (
    <div className={sectionClass(horizontal)}>
      <Heading icon={icon} label={label} hint={hint} />
      <p className="mt-1 leading-none">
        <span className={cn('text-4xl font-extrabold tracking-tight tabular-nums', value === NO_VALUE ? 'text-warmGray' : 'text-charcoal')}>{value}</span>
        {value !== NO_VALUE && <span className="ml-2 text-sm font-medium text-warmGray">{unit}</span>}
      </p>
      {missing && <p className="text-small font-medium text-warmGray">{missing}</p>}
      {/* So với hôm qua: mũi tên kèm số, không chỉ màu */}
      {!missing && deltaPercent !== null && (
        <p className="flex items-center gap-1 text-small font-medium text-warmGray">
          {deltaPercent > 0 && <ArrowUpIcon size={14} weight="bold" className="text-accent-800" aria-hidden />}
          {deltaPercent < 0 && <ArrowDownIcon size={14} weight="bold" className="text-safetyOrange" aria-hidden />}
          <span className={cn('tabular-nums', deltaPercent > 0 && 'text-accent-800', deltaPercent < 0 && 'text-safetyOrange')}>
            {deltaPercent > 0 ? '+' : ''}{num(deltaPercent, 1)} %
          </span>
          {t('today.vsYesterday')}
        </p>
      )}
    </div>
  )
}

function RateMetric({ rate, averageRate, isDrop, dropDetail, horizontal }: {
  rate: number | null; averageRate: number | null; isDrop: boolean; dropDetail?: string; horizontal: boolean
}) {
  const { t, num } = useTranslation(birdFlowDict)
  const hasRate = rate !== null
  const percent = hasRate ? Math.min(100, Math.max(0, rate)) : 0

  return (
    <div className={sectionClass(horizontal)}>
      <div className="flex items-start justify-between gap-2">
        <Heading icon={RepeatIcon} label={t('today.rate')} hint={t('today.rateHint')} />
        {hasRate && <Badge tone={isDrop ? 'critical' : 'positive'} className="shrink-0">{isDrop ? t('today.drop') : t('today.ok')}</Badge>}
      </div>
      <p className="mt-1 leading-none">
        <span className={cn('text-4xl font-extrabold tracking-tight tabular-nums', hasRate ? 'text-charcoal' : 'text-warmGray')}>
          {hasRate ? `${num(rate, 1)} %` : NO_VALUE}
        </span>
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-warmGray/10" role="presentation">
        <div className={cn('h-full rounded-full', isDrop ? 'bg-alertRed' : 'bg-success')} style={{ width: `${percent}%` }} />
      </div>
      {!hasRate && <p className="text-small font-medium text-warmGray">{t('today.rateNeedBoth')}</p>}
      {dropDetail && <p className="text-small font-medium text-alertRed">{dropDetail}</p>}
      {hasRate && !dropDetail && averageRate !== null && (
        <p className="text-small font-medium text-warmGray">{t('today.average', { n: TREND_DAYS, value: `${num(averageRate, 1)} %` })}</p>
      )}
    </div>
  )
}
