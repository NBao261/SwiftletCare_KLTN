import { useParams } from 'react-router-dom';

import HealthReportView from '@/components/features/farm-owner/health/HealthReportView';
import { reportPeriod } from '@/components/features/farm-owner/health/healthReport.utils';
import { EmptyState, LoadingSkeleton } from '@/components/ui';
import { healthDict } from '@/constants/health.i18n';
import { keepPreview } from '@/data/healthPreview.data';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseHealthReport } from '@/hooks/shared/useHealthDays';
import { useHealthReportPdf } from '@/hooks/shared/useHealthReportPdf';

// EXPERT-FR-005, 006, 013 — trang 1 báo cáo sức khỏe theo nhà (/health/reports/:reportId); quay lại tab Báo cáo của /health
export default function FarmOwnerHealthReportPage(): JSX.Element {
  const { reportId } = useParams<{ reportId: string }>();
  const { t, date, dateTime, exact } = useTranslation(healthDict);
  const apiErrorMessage = useApiErrorMessage();
  const { data: report, isLoading, isError, error } = useHouseHealthReport(reportId);
  const { download, downloadingId } = useHealthReportPdf();

  const format = { t, date, dateTime, number: (value: number) => exact(value, 1) };
  usePageBreadcrumb([{ label: report ? `${report.house_name} · ${reportPeriod(report, format)}` : t('report.title') }]);
  usePageBack(keepPreview('/health?tab=report'), t('page.title'));

  if (isLoading) return <LoadingSkeleton count={3} className="h-40 w-full" />;
  if (isError || !report) return <EmptyState title={t('rd.loadFailed')} description={apiErrorMessage(error)} />;

  return <HealthReportView report={report} onDownload={() => void download(report)} isDownloading={downloadingId === report._id} />;
}
