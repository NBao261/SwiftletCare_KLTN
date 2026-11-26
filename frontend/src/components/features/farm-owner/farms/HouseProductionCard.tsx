import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import { KILOGRAM_DIGITS } from '@/components/features/farm-owner/harvest/harvest.constants'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { vnYearMonth } from '@/lib/helpers'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'
import type { HarvestBatch } from '@/types'
import { NO_VALUE } from '@/constants/display'

interface HouseProductionCardProps {
  node: HouseNode
  // Các đợt thu gần nhất của nhà (mới → cũ), chỉ lấy đợt đầu cho dòng "Thu gần nhất"
  recent: HarvestBatch[]
}

// Không hiện mã truy xuất
export default function HouseProductionCard({ node, recent }: HouseProductionCardProps) {
  const { t, num, day } = useTranslation(farmDict)
  const { month, year } = vnYearMonth(new Date())
  const avgPerNest = node.monthNests > 0 ? (node.monthKg * 1000) / node.monthNests : undefined
  const last = recent[0]
  const zoneNames = new Map(node.zones.map(zone => [zone.zone._id, zone.zone.name]))
  const zoneName = (id: string) => zoneNames.get(id) ?? ''

  return (
    <FarmFrame title={t('prod.title')} description={t('prod.month', { month, year })}>
      <div className="rounded-xl bg-warmGray/5 px-4 py-5 text-center">
        <p className="text-metric text-charcoal">{node.monthBatches > 0 ? `${num(node.monthKg, KILOGRAM_DIGITS)} kg` : NO_VALUE}</p>
        <p className="mt-1 text-small text-warmGray">
          {t('prod.nests', { n: num(node.monthNests) })}{avgPerNest !== undefined ? ` · ${t('prod.avg', { g: num(avgPerNest, 1) })}` : ''}
        </p>
      </div>

      <p className="text-small text-warmGray">
        {t('prod.last')}: <span className="font-semibold text-charcoal">{last ? `${day(last.harvest_date)} · ${zoneName(last.zone_id)}` : NO_VALUE}</span>
      </p>
    </FarmFrame>
  )
}
