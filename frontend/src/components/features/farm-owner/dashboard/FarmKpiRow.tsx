import { ClipboardTextIcon, HouseLineIcon, WarningIcon, WifiSlashIcon } from '@phosphor-icons/react';

import KpiTile from '@/components/common/KpiTile';
import type { FarmKpiTotals } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { levelDict } from '@/constants/severity.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { NO_VALUE } from '@/constants/display';

interface FarmKpiRowProps {
  totals: FarmKpiTotals;
  // Phiếu chờ duyệt trong phạm vi; undefined = đang tải
  awaitingApproval: number | undefined;
}

// Hàng 4 ô của Tổng quan (FO-01): nhà, cảnh báo, thiết bị lấy cùng một nguồn với thẻ nhà bên dưới để số khớp nhau (A-03)
export default function FarmKpiRow({ totals, awaitingApproval }: FarmKpiRowProps): JSX.Element {
  const { t, num } = useTranslation(dashboardDict);
  const { t: translateLevel } = useTranslation(levelDict);
  const offlineDevices = totals.devicesTotal - totals.devicesOnline;
  const alertsSub = t('kpi.alertsSub', {
    p1: totals.alertsByLevel.P1, l1: translateLevel('P1'),
    p2: totals.alertsByLevel.P2, l2: translateLevel('P2'),
    p3: totals.alertsByLevel.P3, l3: translateLevel('P3'),
  });

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiTile
        icon={HouseLineIcon}
        label={t('kpi.attention')}
        value={num(totals.faultHouses)}
        sub={t('kpi.attentionSub', { n: num(totals.houses) })}
        tone={totals.faultHouses > 0 ? 'orange' : 'neutral'}
      />
      <KpiTile
        icon={WarningIcon}
        label={t('kpi.pendingAlerts')}
        value={num(totals.alertsTotal)}
        sub={alertsSub}
        tone={totals.alertsByLevel.P1 > 0 ? 'orange' : 'neutral'}
      />
      <KpiTile
        icon={WifiSlashIcon}
        label={t('kpi.offline')}
        value={num(offlineDevices)}
        sub={t('kpi.offlineSub', { online: num(totals.devicesOnline), total: num(totals.devicesTotal) })}
        tone={offlineDevices > 0 ? 'orange' : 'neutral'}
      />
      <KpiTile
        icon={ClipboardTextIcon}
        label={t('kpi.approvals')}
        value={awaitingApproval === undefined ? NO_VALUE : num(awaitingApproval)}
        sub={t('kpi.approvalsSub')}
        tone={awaitingApproval ? 'orange' : 'neutral'}
      />
    </div>
  );
}
