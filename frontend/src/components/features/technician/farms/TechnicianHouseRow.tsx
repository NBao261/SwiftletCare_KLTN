import { ArrowRightIcon, CheckCircleIcon, InfoIcon, WarningIcon } from '@phosphor-icons/react'
import { NO_VALUE } from '@/constants/display'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { METRIC_BY_KEY } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { ownShiftLines } from '@/components/features/technician/farms/ownShifts'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

// Cột của danh sách: nhà, tình trạng, ca trực, thiết bị online, nút; dòng tiêu đề của trang dùng chung khuôn này
export const HOUSE_ROW_GRID = 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_8.5rem]'

interface TechnicianHouseRowProps {
  node: HouseNode
  onOpen: () => void
}

// Chỉ thông tin kỹ thuật, không có sản lượng hay thu hoạch
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
  // backend chỉ trả ca của chính kỹ thuật viên này ("read own roster")
  const shifts = ownShiftLines(house.roster ?? [], key => t(key))

  return (
    <article
      onClick={onOpen}
      className={cn('grid cursor-pointer gap-x-6 gap-y-3 border-b border-warmGray/15 px-5 py-4 transition-colors last:border-b-0 hover:bg-stone/20 lg:items-center', HOUSE_ROW_GRID)}
    >
      {/* Nhà: tên, trang trại, số Zone */}
      <div className="min-w-0">
        <h3 className="truncate text-h3 text-charcoal">{house.name}</h3>
        <p className="truncate text-small text-warmGray">{farm.name} · {t('card.zones', { n: node.zones.length })}</p>
      </div>

      {/* Tình trạng và sự cố cần xử lý */}
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

      {/* Ca trực của chính kỹ thuật viên này */}
      <div className="min-w-0 text-small">
        <p className="label-caption lg:hidden">{t('roster.mine')}</p>
        {shifts.length > 0
          ? <p className="mt-0.5 text-charcoal lg:mt-0">{shifts.join('; ')}</p>
          : <p className="mt-0.5 text-warmGray lg:mt-0">{t('roster.mineNone')}</p>}
      </div>

      {/* Thiết bị online */}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2 lg:justify-start">
          <span className="label-caption lg:hidden">{t('stat.online')}</span>
          <span className={cn('text-small font-semibold tabular-nums', offline > 0 ? 'text-climateOrange' : 'text-charcoal')}>
            {isEmpty ? NO_VALUE : `${num(counts.online)}/${num(counts.total)}`}
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
        <p className="mt-1 text-caption text-warmGray">{num(node.sensors)} {t('stat.sensors').toLowerCase()} · {num(node.cameras)} {t('stat.cameras').toLowerCase()}</p>
      </div>

      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); onOpen() }}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-warmGray/30 bg-white px-4 text-xs font-semibold text-charcoal transition-colors hover:bg-warmGray/5 lg:self-center lg:justify-self-end"
      >
        {t('card.openDevices')}
        <ArrowRightIcon size={12} weight="bold" />
      </button>
    </article>
  )
}
