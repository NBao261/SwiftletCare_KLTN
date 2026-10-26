import { ArrowRightIcon, CheckCircleIcon, HouseIcon, InfoIcon, WarningIcon } from '@phosphor-icons/react'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { METRIC_BY_KEY } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

interface TechnicianHouseRowProps {
  node: HouseNode
  onOpen: () => void
}

/** Thanh trái + tông nền hàng theo tình trạng — kỹ thuật viên quét dọc danh sách là thấy ngay nhà nào cần xử lý */
const ACCENT: Record<HouseNode['health'], string> = {
  ALERT: 'bg-orange-500',
  NORMAL: 'bg-success',
  EMPTY: 'bg-warmGray/30',
}

/**
 * Hàng 1 nhà yến trong màn Trang trại của Technician. Chỉ hiện thứ phục vụ xử lý kỹ thuật:
 * tình trạng, sự cố nổi bật (kèm zone), tỉ lệ thiết bị online, số zone. KHÔNG có sản lượng/thu hoạch/ghim.
 */
export default function TechnicianHouseRow({ node, onOpen }: TechnicianHouseRowProps) {
  const { t, num } = useTranslation(farmDict)
  const { house, farm, headline, counts } = node
  const isEmpty = node.health === 'EMPTY'
  const offline = counts.total - counts.online
  const onlinePct = counts.total > 0 ? Math.round((counts.online / counts.total) * 100) : 0
  const zoneLabel = headline?.zone.name || t('card.unknownZone')

  let issue = ''
  if (headline?.breach) {
    const m = METRIC_BY_KEY[headline.breach.metric]
    issue = t(headline.breach.direction === 'high' ? 'banner.high' : 'banner.low', {
      metric: t(m.labelKey),
      zone: zoneLabel,
      value: `${num(headline.breach.value, m.decimals)} ${m.unit}`,
    })
  } else if (headline?.alert) {
    issue = t('banner.alert', { title: t(`alert.${headline.alert.type}`), zone: zoneLabel })
  } else if (headline) {
    issue = t('banner.offline', { n: headline.offlineDevices ?? 0, zone: zoneLabel })
  }
  const issueCount = node.zones.reduce((sum, z) => sum + z.breaches.length + z.alerts.length, 0)

  return (
    <article className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-warmGray/20 bg-white py-4 pl-6 pr-5 transition-shadow hover:shadow-md lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_auto] lg:items-center lg:gap-6">
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1.5', ACCENT[node.health])} />

      {/* Cột 1 — danh tính nhà */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warmGray/10 text-charcoal">
          <HouseIcon size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-h3 text-charcoal">{house.name}</h3>
          <p className="truncate text-small text-warmGray">
            {farm.name}
          </p>
        </div>
      </div>

      {/* Cột 2 — tình trạng + sự cố cần xử lý */}
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <div className="flex items-center gap-2">
          <HealthBadge health={node.health} />
          {issueCount > 1 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-caption text-orange-800">
              {t('banner.more', { n: issueCount - 1 })}
            </span>
          )}
        </div>
        <p className={cn('flex min-w-0 items-start gap-1.5 text-small', node.health === 'ALERT' ? 'text-orange-800' : 'text-warmGray')}>
          {node.health === 'ALERT'
            ? <WarningIcon size={16} className="mt-0.5 shrink-0" />
            : isEmpty ? <InfoIcon size={16} className="mt-0.5 shrink-0" /> : <CheckCircleIcon size={16} className="mt-0.5 shrink-0" />}
          <span className="line-clamp-2">{isEmpty ? t('banner.empty') : headline ? issue : t('banner.ok')}</span>
        </p>
      </div>

      {/* Cột 3 — thiết bị online */}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label-caption">{t('stat.online')}</span>
          <span className={cn('text-small font-semibold', offline > 0 ? 'text-climateOrange' : 'text-charcoal')}>
            {isEmpty ? '—' : `${num(counts.online)}/${num(counts.total)}`}
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-warmGray/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={onlinePct}
        >
          <div className={cn('h-full rounded-full', offline > 0 ? 'bg-orange-500' : 'bg-success')} style={{ width: `${onlinePct}%` }} />
        </div>
        <p className="mt-1 text-caption text-warmGray">
          {t('card.zones', { n: node.zones.length })} · {num(node.sensors)} {t('stat.sensors').toLowerCase()} · {num(node.cameras)} {t('stat.cameras').toLowerCase()}
        </p>
      </div>

      {/* Cột 4 — hành động */}
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-full bg-charcoal px-4 text-xs font-semibold text-white transition-colors hover:bg-charcoal/85 lg:self-center"
      >
        {t('card.open')}
        <ArrowRightIcon size={12} weight="bold" />
      </button>
    </article>
  )
}
