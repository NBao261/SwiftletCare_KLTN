import { ArrowRightIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import StatusDot from '@/components/common/StatusDot'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { METRIC_BY_KEY, CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { cn } from '@/lib/cn'
import type { MetricKey, ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'

/** 3 chỉ số chính hiện trên card zone — đủ 6 chỉ số ở trang chi tiết zone */
const CARD_METRICS: MetricKey[] = ['temperature', 'humidity', 'nh3']

interface ZoneCardProps { node: ZoneNode; loadingMetrics: boolean; onOpen: () => void }

/** 1 zone trong trang chi tiết nhà: tình trạng, 3 chỉ số chính (realtime qua socket, chưa có thì trung bình 1 giờ), số thiết bị online */
export default function ZoneCard({ node, loadingMetrics, onOpen }: ZoneCardProps) {
  const { t, num } = useTranslation(farmDict)
  const { zone, metrics, breaches, counts } = node
  const over = new Set(breaches.map(b => b.metric))
  const worst = breaches[0]
  const hasData = metrics !== undefined


  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-h3 text-charcoal">{zone.name}</h3>
          <p className="truncate text-small text-warmGray">{t('zone.floor', { n: zone.floor })}</p>
        </div>
        {worst ? (
          <span className="shrink-0 rounded-full bg-climateOrange/15 px-2.5 py-1 text-caption text-climateOrange">
            {t(worst.direction === 'high' ? 'zone.over' : 'zone.under', { metric: t(METRIC_BY_KEY[worst.metric].labelKey) })}
          </span>
        ) : !hasData ? (
          <span className="shrink-0 rounded-full bg-warmGray/15 px-2.5 py-1 text-caption text-warmGray">
            {loadingMetrics ? '…' : t('zone.noSignal')}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-warmGray/10 px-2.5 py-1 text-caption text-graphite">{t('health.normal')}</span>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-warmGray/15 rounded-xl border border-warmGray/15 bg-warmGray/[0.03]">
        {CARD_METRICS.map(key => {
          const meta = METRIC_BY_KEY[key]
          const value = metrics?.[key]
          return (
            <div key={key} className="px-2 py-2 text-center">
              <p className="label-caption truncate">{t(meta.labelKey)}</p>
              <p className={cn('text-h3', value === undefined ? 'text-warmGray' : over.has(key) ? 'text-climateOrange' : 'text-charcoal')}>
                {value !== undefined ? num(value, meta.decimals) : '—'}
                {value !== undefined && <span className="ml-1 text-xs font-medium text-warmGray">{meta.unit}</span>}
              </p>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-small text-warmGray">
          <StatusDot status={counts.total > 0 && counts.online === counts.total ? 'ONLINE' : counts.offline > 0 ? 'OFFLINE' : 'PENDING'} showLabel={false} />
          {t('card.devicesOnline', { online: counts.online, total: counts.total })}
        </span>
        <Button variant="secondary" size="sm" className={cn('h-8 px-3.5 text-xs', CAPSULE_ACTION_CLASS)} onClick={onOpen}>
          {t('zone.open')}
          <ArrowRightIcon size={12} weight="bold" />
        </Button>
      </div>
    </div>
  )
}
