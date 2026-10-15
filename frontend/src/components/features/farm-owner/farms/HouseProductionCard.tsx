import { ArrowRightIcon } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button } from '@/components/ui'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import { HARVEST_STATUS_LABEL, HARVEST_STATUS_TONE } from '@/components/features/farm-owner/harvest/harvest.constants'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { vnYearMonth } from '@/lib/helpers'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'
import type { HarvestBatch } from '@/types'

interface HouseProductionCardProps {
  node: HouseNode
  /** 3 đợt thu hoạch gần nhất của nhà (đã lọc theo zone của nhà) */
  recent: HarvestBatch[]
  nextHarvestAt?: string
}

/** Sản lượng nhà yến trong tháng — số liệu tính từ /harvests thật; "dự kiến thu tiếp" là mock. Không hiện mã truy xuất (ẩn khỏi UI theo quyết định bảo mật). */
export default function HouseProductionCard({ node, recent, nextHarvestAt }: HouseProductionCardProps) {
  const { t, num, day } = useTranslation(farmDict)
  const navigate = useNavigate()
  const { month, year } = vnYearMonth(new Date())
  const avgPerNest = node.monthNests > 0 ? (node.monthKg * 1000) / node.monthNests : undefined
  const last = recent[0]
  const zoneNames = new Map(node.zones.map(z => [z.zone._id, z.zone.name]))
  const zoneName = (id: string) => zoneNames.get(id) ?? ''

  return (
    <FarmFrame title={t('prod.title')} description={t('prod.month', { month, year })}>
      <div className="rounded-xl bg-warmGray/5 px-4 py-5 text-center">
        <p className="text-metric text-charcoal">{num(node.monthKg, 2)} kg</p>
        <p className="mt-1 text-small text-warmGray">
          {t('prod.nests', { n: num(node.monthNests) })}{avgPerNest !== undefined ? ` · ${t('prod.avg', { g: num(avgPerNest, 1) })}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-warmGray/5 px-3 py-2.5">
          <p className="label-caption">{t('prod.last')}</p>
          <p className="mt-0.5 text-small font-semibold text-charcoal">{last ? `${day(last.harvest_date)} · ${zoneName(last.zone_id)}` : '—'}</p>
        </div>
        <div className="rounded-xl bg-warmGray/5 px-3 py-2.5">
          <p className="label-caption">{t('prod.next')}</p>
          <p className="mt-0.5 text-small font-semibold text-charcoal">{nextHarvestAt ? day(nextHarvestAt) : t('prod.noSchedule')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="label-caption">{t('prod.recent')}</p>
        {recent.length === 0 && <p className="text-small text-warmGray">{t('prod.none')}</p>}
        {recent.map(b => (
          <div key={b._id} className="flex items-center justify-between gap-2 rounded-xl border border-warmGray/15 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-small font-semibold text-charcoal">{day(b.harvest_date)} · {zoneName(b.zone_id)}</p>
              <p className="text-caption text-warmGray">{num(b.weight_grams)} g · {num(b.nest_count)} {t('prod.nestUnit')}</p>
            </div>
            <Badge tone={HARVEST_STATUS_TONE[b.status]}>{HARVEST_STATUS_LABEL[b.status]}</Badge>
          </div>
        ))}
      </div>

      <Button variant="secondary" size="sm" className={cn('h-9 w-full text-xs', CAPSULE_ACTION_CLASS)} onClick={() => navigate('/harvests')}>
        {t('prod.viewAll')}
        <ArrowRightIcon size={12} weight="bold" />
      </Button>
    </FarmFrame>
  )
}
