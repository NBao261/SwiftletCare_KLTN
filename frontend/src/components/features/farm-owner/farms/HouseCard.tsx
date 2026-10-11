import { ArrowRightIcon, CheckCircleIcon, HouseIcon, UserIcon, WarningIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { METRIC_BY_KEY } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

interface HouseCardProps {
  node: HouseNode
  staff?: { name: string; initials: string }
  onOpen: () => void
}

/** Card 1 nhà yến trong lưới "Cấu trúc Farm": cảnh báo nổi bật, thống kê số cảm biến/camera/online (số đo chỉ hiện ở cấp Zone), sản lượng tháng */
export default function HouseCard({ node, staff, onOpen }: HouseCardProps) {
  const { t, num } = useT(farmDict)
  const { house, farm, headline, counts } = node
  const issues = node.zones.reduce((sum, z) => sum + z.breaches.length + z.alerts.length, 0)
  const offline = counts.total - counts.online

  const stats = [
    { label: t('stat.sensors'), value: num(node.sensors), warn: false },
    { label: t('stat.cameras'), value: num(node.cameras), warn: false },
    { label: t('stat.online'), value: `${num(counts.online)}/${num(counts.total)}`, warn: offline > 0 },
  ]

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-warmGray/15 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warmGray/10 text-charcoal">
            <HouseIcon size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-h3 text-charcoal">{house.name}</h3>
            <p className="truncate text-small text-warmGray">{farm.address}{farm.region ? ` · ${farm.region}` : ''}</p>
          </div>
        </div>
        <HealthBadge health={node.health} />
      </div>

      {headline ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-climateOrange/30 bg-climateOrange/[0.06] px-3 py-2 text-small text-climateOrange">
          <span className="flex min-w-0 items-center gap-2">
            <WarningIcon size={16} className="shrink-0" />
            <span className="truncate">
              {headline.breach
                ? t(headline.breach.direction === 'high' ? 'banner.high' : 'banner.low', {
                    metric: t(METRIC_BY_KEY[headline.breach.metric].labelKey),
                    zone: headline.zone.name,
                    value: `${num(headline.breach.value, METRIC_BY_KEY[headline.breach.metric].decimals)} ${METRIC_BY_KEY[headline.breach.metric].unit}`,
                  })
                : t('banner.alert', { title: headline.alert?.title ?? '', zone: headline.zone.name })}
            </span>
          </span>
          {issues > 1 && <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-caption">{t('banner.more', { n: issues - 1 })}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-warmGray/15 bg-warmGray/5 px-3 py-2 text-small text-graphite">
          <CheckCircleIcon size={16} className="shrink-0 text-warmGray" />
          {t('banner.ok')}
        </div>
      )}

      <div className="grid grid-cols-3 divide-x divide-warmGray/15 rounded-xl border border-warmGray/15">
        {stats.map(s => (
          <div key={s.label} className="px-3 py-2.5">
            <p className="label-caption truncate">{s.label}</p>
            <p className={cn('mt-0.5 text-h3', s.warn ? 'text-climateOrange' : 'text-charcoal')}>{s.value}</p>
          </div>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 text-small text-warmGray">
        <span>{t('card.zones', { n: node.zones.length })}</span>
        <span aria-hidden="true">•</span>
        <span>{t('card.yield', { kg: num(node.monthKg, 2) })}</span>
      </p>

      <div className="flex items-center justify-between gap-3 border-t border-warmGray/10 pt-3">
        {staff ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-charcoal text-caption text-white">{staff.initials}</span>
            <div className="min-w-0">
              <p className="label-caption">{t('card.staff')}</p>
              <p className="truncate text-small font-semibold text-charcoal">{staff.name}</p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-warmGray/40 text-warmGray">
              <UserIcon size={14} />
            </span>
            <div className="min-w-0">
              <p className="label-caption">{t('card.staff')}</p>
              <p className="truncate text-small text-warmGray">{t('card.noStaff')}</p>
            </div>
          </div>
        )}
        <Button variant="secondary" size="sm" className="h-8 shrink-0 px-3.5 text-xs" onClick={onOpen}>
          {t('card.open')}
          <ArrowRightIcon size={12} weight="bold" />
        </Button>
      </div>
    </article>
  )
}
