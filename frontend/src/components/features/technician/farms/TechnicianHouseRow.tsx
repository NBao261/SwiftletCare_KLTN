import { ArrowRightIcon, CaretDownIcon, CheckCircleIcon, DropIcon, InfoIcon, ThermometerIcon, WarningIcon } from '@phosphor-icons/react'
import { NO_VALUE } from '@/constants/display'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { METRIC_BY_KEY } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { ownShiftLines } from '@/components/features/technician/farms/ownShifts'
import { zoneIssues } from '@/components/features/technician/farms/zoneIssues'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import type { HouseNode, ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'

// Cột của danh sách: nhà, tình trạng, ca trực, thiết bị online, nút mở; dòng tiêu đề và dòng Zone dùng chung khuôn này
export const HOUSE_ROW_GRID = 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_2.5rem]'

interface TechnicianHouseRowProps {
  node: HouseNode
  // Nhà đang có việc cần xử lý thì mở sẵn các Zone để thấy ngay Zone nào
  isOpen: boolean
  onToggle: () => void
  // Không truyền zoneId thì mở thiết bị của cả nhà
  onOpenDevices: (zoneId?: string) => void
}

// Thanh tiến độ thiết bị online: cam khi có thiết bị mất kết nối
function OnlineBar({ online, total }: { online: number; total: number }) {
  const pct = total > 0 ? Math.round((online / total) * 100) : 0
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-warmGray/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={cn('h-full rounded-full', online < total ? 'bg-orange-500' : 'bg-success')} style={{ width: `${pct}%` }} />
    </div>
  )
}

// Một Zone của nhà: tình trạng và việc cần xử lý, nhiệt độ và độ ẩm gần nhất, thiết bị online; bấm để xem thiết bị của Zone
function ZoneLine({ zone, onOpen }: { zone: ZoneNode; onOpen: () => void }) {
  const { t, num } = useTranslation(farmDict)
  const issues = zoneIssues(zone, (key, params) => t(key as never, params), num)
  const { temperature, humidity } = zone.metrics ?? {}
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('grid w-full gap-x-6 gap-y-2 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white lg:items-center', HOUSE_ROW_GRID)}
    >
      <span className="min-w-0 truncate text-sm font-semibold text-charcoal lg:pl-3">{zone.zone.name}</span>
      <span className="flex min-w-0 flex-col items-start gap-1">
        <HealthBadge health={zone.health} />
        {issues.length > 0 && <span className="text-small text-orange-800">{issues.join(' · ')}</span>}
      </span>
      <span className="flex items-center gap-3 text-small tabular-nums text-charcoal">
        {temperature === undefined && humidity === undefined && <span className="text-warmGray">{t('zone.noSignal')}</span>}
        {temperature !== undefined && (
          <span className="inline-flex items-center gap-1"><ThermometerIcon size={14} className="text-warmGray" aria-hidden />{num(temperature, METRIC_BY_KEY.temperature.decimals)}°C</span>
        )}
        {humidity !== undefined && (
          <span className="inline-flex items-center gap-1"><DropIcon size={14} className="text-warmGray" aria-hidden />{num(humidity, METRIC_BY_KEY.humidity.decimals)}%</span>
        )}
      </span>
      <span className="min-w-0 text-small">
        <span className={cn('font-semibold tabular-nums', zone.counts.offline > 0 ? 'text-climateOrange' : 'text-charcoal')}>
          {zone.counts.total === 0 ? NO_VALUE : `${num(zone.counts.online)}/${num(zone.counts.total)}`}
        </span>
        <span className="text-warmGray"> {t('stat.online').toLowerCase()}</span>
        <OnlineBar online={zone.counts.online} total={zone.counts.total} />
      </span>
      <ArrowRightIcon size={14} weight="bold" aria-hidden className="text-warmGray max-lg:hidden lg:justify-self-end" />
    </button>
  )
}

// Chỉ thông tin kỹ thuật, không có sản lượng hay thu hoạch
export default function TechnicianHouseRow({ node, isOpen, onToggle, onOpenDevices }: TechnicianHouseRowProps) {
  const { t, num } = useTranslation(farmDict)
  const { house, farm, headline, counts } = node
  const isEmpty = node.health === 'EMPTY'
  const offline = counts.total - counts.online
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
  // Zone cần xử lý lên đầu
  const zones = [...node.zones].sort((a, b) => Number(b.health === 'ALERT') - Number(a.health === 'ALERT'))

  return (
    <article className="border-b border-warmGray/15 last:border-b-0">
      <div
        onClick={onToggle}
        className={cn('grid cursor-pointer gap-x-6 gap-y-3 px-5 py-4 transition-colors hover:bg-stone/20 lg:items-center', HOUSE_ROW_GRID, isOpen && 'bg-stone/20')}
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

        {/* Thiết bị online của cả nhà */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 lg:justify-start">
            <span className="label-caption lg:hidden">{t('stat.online')}</span>
            <span className={cn('text-small font-semibold tabular-nums', offline > 0 ? 'text-climateOrange' : 'text-charcoal')}>
              {isEmpty ? NO_VALUE : `${num(counts.online)}/${num(counts.total)}`}
            </span>
          </div>
          <OnlineBar online={counts.online} total={counts.total} />
          <p className="mt-1 text-caption text-warmGray">{num(node.sensors)} {t('stat.sensors').toLowerCase()} · {num(node.cameras)} {t('stat.cameras').toLowerCase()}</p>
        </div>

        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onToggle() }}
          aria-expanded={isOpen}
          aria-label={t('tech.zonesToggle', { name: house.name })}
          title={t('tech.zonesToggle', { name: house.name })}
          className={cn('flex h-9 w-9 items-center justify-center self-start rounded-lg transition-colors max-lg:ml-auto lg:self-center lg:justify-self-end', isOpen ? 'bg-charcoal text-white' : 'text-charcoal hover:bg-warmGray/10')}
        >
          <CaretDownIcon size={16} className={cn('transition-transform duration-200', isOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Các Zone của nhà; bấm một Zone để xem thiết bị của Zone đó */}
      {isOpen && (
        <div className="flex flex-col gap-1 border-t border-warmGray/15 bg-stone/20 px-2 py-2 sm:px-5">
          {zones.length === 0 ? (
            <p className="px-3 py-3 text-small text-warmGray">{t('banner.empty')}</p>
          ) : (
            zones.map(zone => <ZoneLine key={zone.zone._id} zone={zone} onOpen={() => onOpenDevices(zone.zone._id)} />)
          )}
          <div className="px-3 pb-1 pt-2">
            <button
              type="button"
              onClick={() => onOpenDevices()}
              className="inline-flex items-center gap-1.5 text-small font-semibold text-accent-700 hover:underline"
            >
              {t('tech.openHouseDevices')}
              <ArrowRightIcon size={12} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
