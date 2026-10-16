import { Bot, Lightbulb } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import type { AllZone } from '@/hooks/shared/useFarms'
import { useHouseAdvice } from '@/hooks/farm-owner/useFarmStructure'
import { useZoneReturnRates } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'

const TREND_DAYS = 30
const GOOD_RATE = 80
const OK_RATE = 65

function getBarClass(rate: number): string {
  if (rate >= GOOD_RATE) return 'bg-success'
  if (rate >= OK_RATE) return 'bg-climateOrange'
  return 'bg-alertRed'
}

interface NestingDensityCardProps {
  zones: AllZone[]
  houseId: string
}

// Tỉ lệ chim về theo Zone và gợi ý AI
export default function NestingDensityCard({ zones, houseId }: NestingDensityCardProps) {
  const { t, num } = useTranslation(dashboardDict)
  const { rates } = useZoneReturnRates(zones.map(zone => zone._id))
  const { data: advice } = useHouseAdvice(houseId || undefined)

  const rateByZone = new Map(rates.map(item => [item.zoneId, item.rate]))
  const rows = zones
    .map(zone => ({ id: zone._id, name: houseId ? zone.name : `${zone.houseName} | ${zone.name}`, rate: rateByZone.get(zone._id) }))
    .flatMap(row => (row.rate === undefined ? [] : [{ ...row, rate: row.rate }]))
    .sort((a, b) => b.rate - a.rate)

  return (
    <div className="flex h-full flex-col gap-4">
      <Card size="lg" className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-h2 text-charcoal">{t('density.title')}</h2>
            <p className="mt-1 text-sm text-warmGray">{t('density.subtitle')}</p>
          </div>
          <Badge tone="neutral">{t('density.badge', { n: TREND_DAYS })}</Badge>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-8 text-center text-sm text-warmGray">
            {t('density.empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {rows.map(row => (
              <div key={row.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-charcoal">{row.name}</span>
                  <span className="shrink-0 font-bold text-charcoal">{num(row.rate, 1)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-warmGray/10">
                  <div className={`h-full rounded-full ${getBarClass(row.rate)}`} style={{ width: `${Math.min(100, row.rate)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card variant="active" size="lg" className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 text-accent-700">
          <Lightbulb width={18} height={18} />
        </span>
        <div>
          <p className="text-sm font-bold text-charcoal">{t('ai.title')}</p>
          {advice ? (
            <p className="mt-1 text-sm text-charcoal/80">{advice.body}</p>
          ) : (
            <p className="mt-1 flex items-center gap-2 text-sm text-charcoal/70">
              <Bot width={16} height={16} className="shrink-0" />
              {t('ai.empty')}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
