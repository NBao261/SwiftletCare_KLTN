import { BellIcon, DropIcon, RobotIcon, ThermometerIcon, UserCircleIcon } from '@phosphor-icons/react';

import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { alertTypeDict } from '@/constants/enumLabels.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useLatestHealthReport } from '@/hooks/farm-owner/useHealthReports';
import type { AlertType } from '@/types';

// Loại cảnh báo phát sinh nhiều nhất trong kỳ, null khi kỳ không có cảnh báo
function mostFrequentAlertType(alertsByType: Record<string, number>): string | null {
  let topType: string | null = null;
  let topCount = 0;
  for (const [type, count] of Object.entries(alertsByType)) {
    if (count > topCount) {
      topType = type;
      topCount = count;
    }
  }
  return topType;
}

interface HealthReportCardProps {
  zoneId: string;
}

// Báo cáo sức khỏe Zone mới nhất và kết luận của chuyên gia (EXPERT-FR-005/006) — Farm Owner chỉ đọc
export default function HealthReportCard({ zoneId }: HealthReportCardProps): JSX.Element {
  const { t, num, date, dateTime } = useTranslation(analyticsDict);
  const { t: translateAlertType } = useTranslation(alertTypeDict);
  const { data: report, isLoading, isError, refetch } = useLatestHealthReport(zoneId);

  // Số 1 chữ số lẻ, chưa có thì gạch ngang
  const oneDecimal = (value: number | null): string => (value === null ? NO_VALUE : num(value, 1));

  // Nhãn loại cảnh báo; loại backend mới mà FE chưa có nhãn thì ghi "khác"
  const alertTypeLabel = (type: string): string => {
    if (!(type in alertTypeDict.vi)) return t('health.otherAlert');
    return translateAlertType(type as AlertType);
  };

  if (isLoading) {
    return (
      <FarmFrame title={t('health.title')} className="h-full">
        <LoadingSkeleton count={3} className="h-20 w-full" />
      </FarmFrame>
    );
  }

  if (isError) {
    return (
      <FarmFrame title={t('health.title')} className="h-full">
        <EmptyState
          title={t('common.loadError')}
          action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
        />
      </FarmFrame>
    );
  }

  // Chưa có báo cáo vẫn hiện đủ khung, các thông số ghi "_"
  const metrics = report?.metrics;
  const conclusion = report?.expert_conclusion ?? null;
  let alertTotal = 0;
  for (const count of Object.values(metrics?.alerts_by_type ?? {})) alertTotal += count;
  const topAlertType = metrics ? mostFrequentAlertType(metrics.alerts_by_type) : null;
  const samplesSub = metrics ? t('health.samples', { n: num(metrics.sample_count) }) : NO_VALUE;

  // Dòng phụ ô cảnh báo: loại nhiều nhất, không có cảnh báo, hoặc chưa có báo cáo
  let alertsSub = NO_VALUE;
  if (metrics) alertsSub = topAlertType ? t('health.alertsTop', { type: alertTypeLabel(topAlertType) }) : t('health.noAlerts');

  return (
    <FarmFrame
      title={t('health.title')}
      description={report ? t('health.period', { from: date(report.period_start), to: date(report.period_end) }) : t('health.subtitleEmpty')}
      className="h-full"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiTile icon={ThermometerIcon} label={t('health.temperature')} value={oneDecimal(metrics?.temp_in_range_pct ?? null)} unit={metrics ? '%' : undefined} sub={samplesSub} />
        <KpiTile icon={DropIcon} label={t('health.humidity')} value={oneDecimal(metrics?.humidity_in_range_pct ?? null)} unit={metrics ? '%' : undefined} sub={samplesSub} />
        <KpiTile
          icon={RobotIcon}
          label={t('health.auto')}
          value={oneDecimal(metrics?.auto_mode_pct ?? null)}
          unit={metrics ? '%' : undefined}
          sub={metrics ? t('health.switches', { misting: num(metrics.misting_switches), ventilation: num(metrics.ventilation_switches) }) : NO_VALUE}
        />
        <KpiTile icon={BellIcon} label={t('health.alerts')} value={metrics ? num(alertTotal) : NO_VALUE} sub={alertsSub} />
      </div>

      {/* Khí NH3, CO2 và tỷ lệ chim về trong kỳ */}
      <div className="flex flex-col gap-1 text-small text-graphite">
        <p>{t('health.nh3', { average: oneDecimal(metrics?.nh3_avg ?? null), max: oneDecimal(metrics?.nh3_max ?? null) })}</p>
        <p>{t('health.co2', { average: oneDecimal(metrics?.co2_avg ?? null), max: oneDecimal(metrics?.co2_max ?? null) })}</p>
        {metrics && metrics.avg_return_rate !== null && <p>{t('health.returnRate', { value: num(metrics.avg_return_rate, 1) })}</p>}
      </div>

      {/* Kết luận của chuyên gia */}
      <div className="flex flex-col gap-2 rounded-2xl border border-warmGray/15 bg-warmGray/5 p-4">
        <p className="label-caption">{t('health.conclusionTitle')}</p>
        {conclusion ? (
          <>
            <p className="whitespace-pre-line text-body text-charcoal">{conclusion.text}</p>
            <p className="flex items-center gap-1.5 text-small text-warmGray">
              <UserCircleIcon size={14} aria-hidden="true" />
              {t('health.conclusionBy', { name: conclusion.by?.full_name ?? t('health.expert'), time: dateTime(conclusion.at) })}
            </p>
          </>
        ) : (
          <p className="text-small text-warmGray">{report ? t('health.noConclusion') : t('health.empty')}</p>
        )}
      </div>
    </FarmFrame>
  );
}
