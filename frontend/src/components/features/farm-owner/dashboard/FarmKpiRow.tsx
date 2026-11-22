import { ClipboardTextIcon, HouseLineIcon, WarningIcon, WifiSlashIcon } from '@phosphor-icons/react';

import KpiTile from '@/components/common/KpiTile';
import type { FarmKpiTotals } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { NO_VALUE } from '@/constants/display';

interface FarmKpiRowProps {
  totals: FarmKpiTotals;
  // Cảnh báo chưa xử lý cộng từ thẻ nhà (overview); undefined = đang tải
  openAlerts: number | undefined;
  // Overview của một trang trại tải lỗi: ô ghi lỗi kèm Thử lại thay vì đứng ở "_"
  isOpenAlertsError: boolean;
  onRetryOpenAlerts: () => void;
  // Phiếu chờ duyệt trong phạm vi; undefined = đang tải
  awaitingApproval: number | undefined;
}

// Cùng nguồn với thẻ nhà bên dưới để số khớp nhau
export default function FarmKpiRow({ totals, openAlerts, isOpenAlertsError, onRetryOpenAlerts, awaitingApproval }: FarmKpiRowProps): JSX.Element {
  const { t, num } = useTranslation(dashboardDict);
  // Chỉ thiết bị OFFLINE; thiết bị vừa thêm còn chờ kết nối lần đầu không phải "mất kết nối"
  const offlineDevices = totals.devicesOffline;

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
        label={t('kpi.openAlerts')}
        value={openAlerts === undefined ? NO_VALUE : num(openAlerts)}
        sub={isOpenAlertsError ? t('kpi.openAlertsError') : t('kpi.openAlertsSub', { n: num(totals.alertsTotal) })}
        tone={totals.alertsTotal > 0 ? 'orange' : 'neutral'}
        badge={isOpenAlertsError && (
          <button type="button" onClick={onRetryOpenAlerts} className="text-small font-semibold text-charcoal underline underline-offset-4 max-sm:min-h-11">
            {t('log.retry')}
          </button>
        )}
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
