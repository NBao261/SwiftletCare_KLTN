import { Link } from 'react-router-dom';
import { ClockIcon, WrenchIcon } from '@phosphor-icons/react';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import { Button, LoadingSkeleton } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseOpsMetrics, useOpenWorkOrderCount } from '@/hooks/farm-owner/useWorkOrders';

interface HouseOpsMetricsCardProps {
  farmId: string;
  houseId: string;
}

// OPS-FR-009, BR-40 — MTTA, MTTR của nhà trong 30 ngày và số Work Order đang mở; Farm Owner và Domain Expert xem
export default function HouseOpsMetricsCard({ farmId, houseId }: HouseOpsMetricsCardProps): JSX.Element {
  const { t, num } = useTranslation(workOrderDict);
  const apiErrorMessage = useApiErrorMessage();
  const metrics = useHouseOpsMetrics(farmId, houseId);
  const openCount = useOpenWorkOrderCount(houseId);
  const overall = metrics.data?.overall;
  // Số liệu và số phiếu chưa đóng chung 1 trạng thái tải/lỗi: lỗi thì không hiện "_" thay cho số chưa tải được (FE_Design 13.16 b)
  const isLoading = metrics.isLoading || openCount.isLoading;
  const loadError = metrics.error ?? openCount.error;
  const retry = () => {
    void metrics.refetch();
    void openCount.refetch();
  };
  // Số phút 1 chữ số lẻ kèm đơn vị; không có mẫu thì "_" không đơn vị
  const minutes = (value: number | null) => (value === null
    ? { value: NO_VALUE }
    : { value: num(value, 1), unit: t('metrics.unit') });

  return (
    <FarmFrame
      title={t('metrics.title')}
      description={t('metrics.desc')}
      action={<Link to="/work-orders" className="text-xs font-semibold text-charcoal underline-offset-4 hover:underline">{t('metrics.viewAll')}</Link>}
    >
      {isLoading ? (
        <LoadingSkeleton count={3} className="h-16 w-full" />
      ) : loadError || !overall || openCount.data === undefined ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-warmGray">{apiErrorMessage(loadError, t('metrics.loadFailed'))}</p>
          <Button variant="secondary" size="sm" onClick={retry}>{t('page.retry')}</Button>
        </div>
      ) : (
        <>
          {/* Cột aside 360px chỉ đủ 1 ô mỗi hàng để nhãn không bị cắt; màn vừa thì 2 ô */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <KpiTile
              icon={ClockIcon}
              label={t('metrics.mtta')}
              {...minutes(overall.mtta_min)}
              sub={overall.acknowledged_within_target_pct === null
                ? t('metrics.alerts', { n: overall.alerts })
                : t('metrics.withinTarget', { pct: overall.acknowledged_within_target_pct, target: metrics.data?.target_ack_min ?? NO_VALUE })}
            />
            <KpiTile icon={WrenchIcon} label={t('metrics.mttr')} {...minutes(overall.mttr_min)} sub={t('metrics.alerts', { n: overall.alerts })} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-warmGray/5 px-3 py-3 text-small">
            <span className="text-graphite">{t('metrics.openWorkOrders')}</span>
            <span className="font-semibold text-charcoal">{openCount.data}</span>
          </div>
        </>
      )}
    </FarmFrame>
  );
}
