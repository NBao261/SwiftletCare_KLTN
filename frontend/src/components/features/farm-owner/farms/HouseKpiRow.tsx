import { BellRingingIcon, HouseIcon, PackageIcon, WifiHighIcon } from '@phosphor-icons/react'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import KpiTile from '@/components/features/farm-owner/farms/KpiTile'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { StructureTotals } from '@/components/features/farm-owner/farms/farmStructure'

/** 4 ô KPI đầu màn "Cấu trúc Farm", bọc 1 khung như EnvSensorPanel ở Dashboard — số liệu tính từ cây cấu trúc thật (thiết bị, cảnh báo ACTIVE = chưa xác nhận, thu hoạch trong tháng giờ VN) */
export default function HouseKpiRow({ totals, monthLabel }: { totals: StructureTotals; monthLabel: number }) {
  const { t, num, day } = useT(farmDict)
  const { counts, alerts } = totals
  const onlinePct = counts.total > 0 ? (counts.online / counts.total) * 100 : 0
  // Thiết bị chưa online = mất kết nối (OFFLINE/ERROR) + đang chờ kết nối (PENDING/DEGRADED)
  const waiting = counts.total - counts.online - counts.offline
  const deviceIssues = [
    counts.offline > 0 && t('kpi.offlineCount', { n: counts.offline }),
    waiting > 0 && t('kpi.waitingCount', { n: waiting }),
  ].filter(Boolean).join(' · ')
  const yieldSub = totals.monthBatches === 0
    ? t('kpi.noHarvestMonth')
    : [
        t('kpi.monthBatches', { n: num(totals.monthNests), batches: totals.monthBatches }),
        totals.monthLastBatchAt && t('kpi.lastInMonth', { date: day(totals.monthLastBatchAt) }),
      ].filter(Boolean).join(' · ')

  return (
    <FarmFrame title={t('kpi.title')} description={t('kpi.desc')}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          icon={HouseIcon}
          label={t('kpi.houses')}
          value={totals.houses}
          sub={t('kpi.housesSub', { zones: totals.zones, devices: counts.total })}
        />
        <KpiTile
          icon={WifiHighIcon}
          label={t('kpi.devicesOnline')}
          value={`${counts.online}/${counts.total}`}
          unit={`${num(onlinePct, 1)}%`}
          sub={deviceIssues || t('kpi.allOnline')}
        />
        <KpiTile
          icon={BellRingingIcon}
          label={t('kpi.openAlerts')}
          value={alerts.total}
          accent={alerts.total > 0}
          sub={alerts.total === 0 ? t('kpi.noAlerts') : t('kpi.alertSplit', { high: alerts.high, medium: alerts.medium, low: alerts.low })}
        />
        <KpiTile
          icon={PackageIcon}
          label={t('kpi.monthYield', { month: monthLabel })}
          value={num(totals.monthKg, 2)}
          unit="kg"
          sub={yieldSub}
        />
      </div>
    </FarmFrame>
  )
}
