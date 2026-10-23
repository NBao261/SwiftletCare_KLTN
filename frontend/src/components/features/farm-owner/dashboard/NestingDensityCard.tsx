import { LightbulbIcon, RobotIcon } from '@phosphor-icons/react'
import { Badge, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useHouseAdvice } from '@/hooks/farm-owner/useFarmStructure'
import { useHousesBirdCountTrends } from '@/hooks/farm-owner/useAnalytics'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { NO_VALUE } from '@/constants/display'
import { cn } from '@/lib/cn'

const TREND_DAYS = 30
// Số phiên gần nhất hiện thành thanh
const RECENT_DAYS = 7
const GOOD_RATE = 80
const OK_RATE = 65

function getBarClass(rate: number): string {
  if (rate >= GOOD_RATE) return 'bg-success'
  if (rate >= OK_RATE) return 'bg-climateOrange'
  return 'bg-alertRed'
}

interface NestingDensityCardProps {
  houseId: string
  houseName: string
}

// Tỉ lệ chim về của nhà yến (SRS v2.1.8: camera ở cửa nhà nên số đếm và tỉ lệ tính theo nhà, không theo Zone) và gợi ý AI
export default function NestingDensityCard({ houseId, houseName }: NestingDensityCardProps) {
  const { t, num, date } = useTranslation(dashboardDict)
  const { single: trends, isLoading } = useHousesBirdCountTrends(houseId ? [houseId] : [], TREND_DAYS)
  const { data: advice } = useHouseAdvice(houseId || undefined)
  // Các phiên gần nhất có đủ số để tính tỉ lệ, mới nhất trên cùng
  const recent = (trends?.records ?? []).filter(record => record.return_rate !== null).slice(-RECENT_DAYS).reverse()
  const latest = trends?.latest_return_rate ?? null
  const average = trends?.avg_return_rate ?? null

  return (
    <div className="flex h-full flex-col gap-4">
      <Card size="lg" className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-h2 text-charcoal">{t('density.title')}</h2>
            <p className="mt-1 text-sm text-warmGray">{t('density.subtitle', { house: houseName })}</p>
          </div>
          <Badge tone="neutral">{t('density.badge', { n: TREND_DAYS })}</Badge>
        </div>

        {/* Tỉ lệ phiên gần nhất · trung bình kỳ; chưa có số thì "_" */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-warmGray">{t('density.latest')}</p>
            <p className={cn('text-[28px] font-extrabold leading-tight tracking-tight', latest === null ? 'text-warmGray' : 'text-charcoal')}>
              {latest === null ? NO_VALUE : `${num(latest, 1)}%`}
            </p>
          </div>
          <div>
            <p className="text-xs text-warmGray">{t('density.average', { n: TREND_DAYS })}</p>
            <p className={cn('text-[28px] font-extrabold leading-tight tracking-tight', average === null ? 'text-warmGray' : 'text-charcoal')}>
              {average === null ? NO_VALUE : `${num(average, 1)}%`}
            </p>
          </div>
        </div>
        {trends?.is_significant_drop && trends.drop_percent !== null && (
          <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
            {t('density.drop', { n: num(trends.drop_percent, 1), limit: num(trends.drop_threshold_pct) })}
          </p>
        )}

        {isLoading ? (
          <LoadingSkeleton count={3} className="h-6 w-full" />
        ) : recent.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-6 text-center text-sm text-warmGray">
            {t('density.empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.map(record => {
              const rate = record.return_rate ?? 0
              return (
                <div key={record.date} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-charcoal">{date(`${record.date}T00:00:00+07:00`)}</span>
                    <span className="shrink-0 font-bold text-charcoal">{num(rate, 1)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-warmGray/10">
                    <div className={`h-full rounded-full ${getBarClass(rate)}`} style={{ width: `${Math.min(100, rate)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card variant="active" size="lg" className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 text-accent-700">
          <LightbulbIcon width={18} height={18} />
        </span>
        <div>
          <p className="text-sm font-bold text-charcoal">{t('ai.title')}</p>
          {advice ? (
            <p className="mt-1 text-sm text-charcoal/80">{advice.body}</p>
          ) : (
            <p className="mt-1 flex items-center gap-2 text-sm text-charcoal/70">
              <RobotIcon width={16} height={16} className="shrink-0" />
              {t('ai.empty')}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
