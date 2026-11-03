import { useMemo, type ReactNode } from 'react';

import { FilePdfIcon } from '@phosphor-icons/react';
import HealthStatusBadge from '@/components/features/farm-owner/health/HealthStatusBadge';
import {
  REPORT_STATUSES, incompleteDayCount, reportDayRows, reportPeriod, weatherFacts, zoneFacts, type ReportFact,
} from '@/components/features/farm-owner/health/healthReport.utils';
import { Badge, Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { Drawer } from '@/components/ui/Drawer';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseHealthReport } from '@/hooks/shared/useHealthDays';
import type { HouseHealthReport } from '@/types';

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-charcoal">{title}</p>
      {children}
    </section>
  );
}

function FactList({ facts }: { facts: ReportFact[] }): JSX.Element {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {facts.map(fact => (
        <div key={fact.label} className="flex justify-between gap-3">
          <dt className="shrink-0 text-warmGray">{fact.label}</dt>
          <dd className="text-right font-semibold text-charcoal">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface HealthReportDrawerProps {
  // null = đóng
  reportId: string | null;
  onClose: () => void;
  onDownload: (report: HouseHealthReport) => void;
  isDownloading: boolean;
}

// EXPERT-FR-005, 006 — 1 báo cáo theo nhà: trạng thái các ngày, đàn chim, thời tiết, từng Zone, các ngày, kết luận
export default function HealthReportDrawer({ reportId, onClose, onDownload, isDownloading }: HealthReportDrawerProps): JSX.Element {
  const { t, date, dateTime, exact } = useTranslation(healthDict);
  const apiErrorMessage = useApiErrorMessage();
  const { data: report, isLoading, isError, error } = useHouseHealthReport(reportId ?? undefined);
  const format = useMemo(() => ({ t, date, dateTime, number: (value: number) => exact(value, 1) }), [t, date, dateTime, exact]);
  const dayRows = useMemo(() => (report ? reportDayRows(report, format) : []), [report, format]);

  const title = report ? t('rd.title', { house: report.house_name, period: reportPeriod(report, format) }) : t('report.title');
  const weather = report ? weatherFacts(report, format) : null;
  const incomplete = report ? incompleteDayCount(report) : 0;

  return (
    <Drawer open={Boolean(reportId)} onClose={onClose} title={title}>
      {isLoading ? (
        <LoadingSkeleton />
      ) : isError || !report ? (
        <EmptyState title={t('rd.loadFailed')} description={apiErrorMessage(error)} />
      ) : (
        // Drawer không tự cuộn — vùng cuộn đặt ở đây như HealthDayDrawer
        <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Badge tone="neutral" className="self-start">{t(`kind.${report.kind}`)}</Badge>
              <span className="text-xs text-warmGray">{t('rd.generatedAt', { time: dateTime(report.generated_at) })}</span>
            </div>
            <Button variant="secondary" size="sm" loading={isDownloading} onClick={() => onDownload(report)}>
              <FilePdfIcon size={16} weight="bold" aria-hidden />
              {t('action.pdf')}
            </Button>
          </div>

          <Section title={t('rd.statusCounts')}>
            <div className="flex flex-wrap gap-2">
              {REPORT_STATUSES.map(status => (
                <span key={status} className="flex items-center gap-1.5 text-sm font-semibold text-charcoal">
                  <HealthStatusBadge status={status} />
                  {report.status_counts[status] ?? 0}
                </span>
              ))}
            </div>
            {report.hidden_days > 0 && <p className="text-xs text-warmGray">{t('rd.hiddenDays', { n: report.hidden_days })}</p>}
            <p className="text-xs italic text-warmGray">{t('detail.disclaimer')}</p>
          </Section>

          <Section title={t('rd.flock')}>
            <div className="flex flex-col gap-2 rounded-xl border border-warmGray/30 p-3">
              <FactList facts={[{
                label: t('rd.avgReturn'),
                value: report.house_metrics.avg_return_rate === null ? NO_VALUE : `${format.number(report.house_metrics.avg_return_rate)} %`,
              }]} />
              {incomplete > 0 && <p className="text-xs text-warmGray">{t('rd.incompleteDays', { n: incomplete })}</p>}
            </div>
          </Section>

          <Section title={t('detail.weather')}>
            {weather
              ? <div className="rounded-xl border border-warmGray/30 p-3"><FactList facts={weather} /></div>
              : <p className="text-sm text-warmGray">{t('detail.weatherNone')}</p>}
          </Section>

          <Section title={t('rd.zones')}>
            {report.zone_sections.length === 0 && <p className="text-sm text-warmGray">{t('rd.noZones')}</p>}
            {report.zone_sections.map(section => (
              <div key={section.zone_id} className="flex flex-col gap-3 rounded-xl border border-warmGray/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-charcoal">{section.zone_name}</span>
                  <span className="text-xs text-warmGray">{t('rd.samples', { n: section.sample_count })}</span>
                </div>
                <FactList facts={zoneFacts(section, format)} />
              </div>
            ))}
          </Section>

          <Section title={t('rd.days')}>
            <ul className="flex flex-col gap-3">
              {dayRows.map(row => (
                <li key={row.date} className="flex flex-col gap-2 rounded-xl border border-warmGray/30 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-charcoal">{row.date}</span>
                    {row.status
                      ? <HealthStatusBadge status={row.status} />
                      : <span className="italic text-warmGray">{row.statusText}</span>}
                  </div>
                  <span className="text-xs text-warmGray">{t('rd.returnRate')}: <span className="font-semibold text-charcoal">{row.returnRate}</span></span>
                  {row.reasons.length > 0 && (
                    <ul className="flex flex-col gap-1 border-l-2 border-warmGray/30 pl-3 text-charcoal" aria-label={t('detail.reasons')}>
                      {row.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                    </ul>
                  )}
                  {row.ratings.map((rating, index) => <span key={index} className="text-xs text-graphite">{rating}</span>)}
                </li>
              ))}
            </ul>
          </Section>

          <Section title={t('rd.conclusion')}>
            {report.expert_conclusion ? (
              <div className="flex flex-col gap-2 rounded-xl border border-warmGray/30 p-3 text-sm">
                <p className="whitespace-pre-line text-charcoal">{report.expert_conclusion.text}</p>
                <span className="self-end text-xs text-warmGray">
                  {report.expert_conclusion.by.full_name ?? NO_VALUE} · {dateTime(report.expert_conclusion.at)}
                  {report.expert_conclusion.edited_at && ` · ${t('rd.edited', { time: dateTime(report.expert_conclusion.edited_at) })}`}
                </span>
              </div>
            ) : (
              <p className="text-sm text-warmGray">{t('rd.noConclusion')}</p>
            )}
          </Section>
        </div>
      )}
    </Drawer>
  );
}
