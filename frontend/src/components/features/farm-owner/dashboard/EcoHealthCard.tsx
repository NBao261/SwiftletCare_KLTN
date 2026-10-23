import { Badge, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useHouseStability } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { summarizeStability, type HouseStability, type StabilityStatus } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import { cn } from '@/lib/cn'
import type { House } from '@/types'
import { NO_VALUE } from '@/constants/display'

const DOT_CLASS: Record<StabilityStatus, string> = { FAULT: 'bg-safetyOrange', STABLE: 'bg-success', EMPTY: 'bg-warmGray/40' }
const LABEL_CLASS: Record<StabilityStatus, string> = { FAULT: 'text-safetyOrange', STABLE: 'text-charcoal', EMPTY: 'text-warmGray' }

// Thẻ nhỏ trạng thái các nhà yến trong phạm vi khung lọc, đứng cạnh hàng KPI
export default function EcoHealthCard({ houses }: { houses: House[] }) {
  const { t } = useTranslation(dashboardDict)
  const { items, isLoading } = useHouseStability(houses)
  const { faultHouses, stableCount, hasDevices } = summarizeStability(items)
  const hasFault = faultHouses.length > 0

  let note = t('stability.noDevicesNote')
  if (hasFault) note = faultHouses.map(house => t('stability.faultLine', { name: house.name, n: house.faultyDevices })).join('; ')
  else if (hasDevices) note = t('stability.allNormal')

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="label-caption">{t('stability.caption')}</p>
        <Badge tone="positive">{t('stability.stable')}</Badge>
      </div>

      <div>
        <p className="leading-none">
          <span className="text-[32px] font-extrabold tracking-tight text-charcoal">{isLoading ? NO_VALUE : stableCount}</span>
          <span className="ml-1 text-sm font-semibold text-warmGray">/{isLoading ? NO_VALUE : items.length}</span>
        </p>
        {!isLoading && (
          <p className={cn('mt-2 truncate text-xs font-medium', hasFault ? 'text-safetyOrange' : 'text-warmGray')} title={note}>{note}</p>
        )}
      </div>

      <div className="relative min-h-0 flex-1 border-t border-warmGray/10 pt-3">
        {isLoading ? (
          <LoadingSkeleton count={3} className="h-5 w-full" />
        ) : (
          <ul className="absolute inset-x-0 bottom-0 top-3 flex flex-col gap-2 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map(house => (
              <HouseRow key={house.houseId} house={house} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

// 1 dòng nhà yến: chấm màu + tên + số thiết bị lỗi hoặc trạng thái
function HouseRow({ house }: { house: HouseStability }) {
  const { t } = useTranslation(dashboardDict)
  const labels: Record<StabilityStatus, string> = {
    FAULT: t('stability.rowFault', { n: house.faultyDevices }),
    STABLE: t('stability.rowStable'),
    EMPTY: t('stability.rowEmpty'),
  }

  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-warmGray">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASS[house.status])} />
        <span className="truncate">{house.name}</span>
      </span>
      <span className={cn('shrink-0 font-bold', LABEL_CLASS[house.status])}>{labels[house.status]}</span>
    </li>
  )
}
