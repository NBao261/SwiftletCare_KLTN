import { Link } from 'react-router-dom';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import { LoadingSkeleton } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseOpsMetrics, useOpenWorkOrderCount } from '@/hooks/farm-owner/useWorkOrders';

interface HouseOpsMetricsCardProps {
  farmId: string;
  houseId: string;
}

// OPS-FR-009, BR-40 — MTTA, MTTR của nhà trong 30 ngày và số Work Order đang mở; Farm Owner và Domain Expert xem
export default function HouseOpsMetricsCard({ farmId, houseId }: HouseOpsMetricsCardProps): JSX.Element {
  const { t, num } = useTranslation(workOrderDict);
  const metrics = useHouseOpsMetrics(farmId, houseId);
  const openCount = useOpenWorkOrderCount(houseId);
  const overall = metrics.data?.overall;
  // Phút 1 chữ số lẻ; không có mẫu thì "_"
  const minutes = (value: number | null | undefined) => (value === null || value === undefined ? NO_VALUE : t('metrics.minutes', { value: num(value, 1) }));

  return (
    <FarmFrame
      title={t('metrics.title')}
      description={t('metrics.desc')}
      action={<Link to="/work-orders" className="text-xs font-semibold text-charcoal underline-offset-4 hover:underline">{t('metrics.viewAll')}</Link>}
    >
      {metrics.isLoading ? (
        <LoadingSkeleton count={2} className="h-16 w-full" />
      ) : metrics.isError || !overall ? (
        <p className="text-sm text-warmGray">{t('metrics.loadFailed')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-warmGray/15 bg-white p-4">
              <p className="label-caption">{t('metrics.mtta')}</p>
              <p className="mt-2 text-xl font-extrabold leading-none tracking-tight text-charcoal">{minutes(overall.mtta_min)}</p>
            </div>
            <div className="rounded-2xl border border-warmGray/15 bg-white p-4">
              <p className="label-caption">{t('metrics.mttr')}</p>
              <p className="mt-2 text-xl font-extrabold leading-none tracking-tight text-charcoal">{minutes(overall.mttr_min)}</p>
            </div>
          </div>
          <p className="text-[11px] font-medium text-warmGray">
            {t('metrics.alerts', { n: overall.alerts })}
            {overall.acknowledged_within_target_pct !== null && (
              <> · {t('metrics.withinTarget', { pct: overall.acknowledged_within_target_pct, target: metrics.data?.target_ack_min ?? NO_VALUE })}</>
            )}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between rounded-xl bg-warmGray/5 px-3 py-3 text-small">
        <span className="text-graphite">{t('metrics.openWorkOrders')}</span>
        <span className="font-semibold text-charcoal">{openCount.data ?? NO_VALUE}</span>
      </div>
    </FarmFrame>
  );
}
