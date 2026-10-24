import { HouseLineIcon, PackageIcon, SquaresFourIcon, WarningIcon, WifiHighIcon } from '@phosphor-icons/react';

import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import type { FarmKpiTotals } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { levelDict } from '@/constants/severity.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { KILOGRAM_DIGITS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { NO_VALUE } from '@/constants/display';

interface FarmKpiRowProps {
  totals: FarmKpiTotals;
  // false = role không xem được thu hoạch → ẩn ô sản lượng thay vì hiện 0
  showYield: boolean;
}

// Hàng KPI chế độ "Tất cả nhà yến": số liệu chung của mọi nhà trong trang trại đang chọn ('' = mọi trang trại)
export default function FarmKpiRow({ totals, showYield }: FarmKpiRowProps): JSX.Element {
  const { t, num } = useTranslation(dashboardDict);
  const { t: translateLevel } = useTranslation(levelDict);
  const offlineDevices = totals.devicesTotal - totals.devicesOnline;
  const alertsSub = t('kpi.alertsSub', {
    p1: totals.alertsByLevel.P1, l1: translateLevel('P1'),
    p2: totals.alertsByLevel.P2, l2: translateLevel('P2'),
    p3: totals.alertsByLevel.P3, l3: translateLevel('P3'),
  });

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <KpiTile
        icon={HouseLineIcon}
        label={t('kpi.houses')}
        value={num(totals.houses)}
        sub={totals.faultHouses > 0 ? t('kpi.housesIssue', { n: totals.faultHouses }) : t('kpi.housesNone')}
        tone={totals.faultHouses > 0 ? 'orange' : 'neutral'}
      />
      <KpiTile icon={SquaresFourIcon} label={t('kpi.zones')} value={num(totals.zones)} sub={t('kpi.zonesSub', { n: totals.houses })} />
      <KpiTile
        icon={WifiHighIcon}
        label={t('kpi.devices')}
        value={`${num(totals.devicesOnline)}/${num(totals.devicesTotal)}`}
        sub={offlineDevices > 0 ? t('kpi.devicesOffline', { n: offlineDevices }) : t('kpi.devicesAllOnline')}
        tone={offlineDevices > 0 ? 'orange' : 'neutral'}
      />
      <KpiTile
        icon={WarningIcon}
        label={t('kpi.alerts')}
        value={num(totals.alertsTotal)}
        sub={alertsSub}
        tone={totals.alertsByLevel.P1 > 0 ? 'orange' : 'neutral'}
      />
      {showYield && (
        <KpiTile
          icon={PackageIcon}
          label={t('kpi.harvest')}
          value={totals.monthBatches > 0 ? num(totals.monthKg, KILOGRAM_DIGITS) : NO_VALUE}
          unit={totals.monthBatches > 0 ? 'kg' : undefined}
          sub={t('kpi.harvestSub', { nests: num(totals.monthNests), batches: num(totals.monthBatches) })}
        />
      )}
    </div>
  );
}
