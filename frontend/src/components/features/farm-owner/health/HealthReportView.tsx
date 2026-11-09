import { useMemo, type ReactNode } from 'react';

import { FilePdfIcon } from '@phosphor-icons/react';
import HealthStatusBadge from '@/components/features/farm-owner/health/HealthStatusBadge';
import {
  REPORT_STATUSES, incompleteDayCount, reportDayRows, reportPeriod, weatherFacts, zoneFacts, type ReportFact,
} from '@/components/features/farm-owner/health/healthReport.utils';
import { Button } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { HealthStatus, HouseHealthReport } from '@/types';

// Cùng màu badge trạng thái (HealthStatusBadge): Tốt xanh, Theo dõi cam, Cần xử lý đỏ, Thiếu dữ liệu xám
const STATUS_BAR: Record<HealthStatus, string> = {
  GOOD: 'bg-limeMist',
  WATCH: 'bg-climateOrange',
  ACTION: 'bg-alertRed',
  INSUFFICIENT_DATA: 'bg-warmGray/50',
};

// Một mục của trang: tiêu đề + nội dung, nét kẻ mảnh ngăn các mục
function Part({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-4 border-t border-warmGray/15 pt-6">
      <h2 className="text-h2 text-charcoal">{title}</h2>
      {children}
    </section>
  );
}

// Nhóm nhỏ của phần tóm tắt; các nhóm nằm cạnh nhau khi thẻ đủ rộng, hẹp thì tự xuống hàng (theo độ rộng thẻ, không theo màn hình)
function Group({ title, grow, children }: { title: string; grow: string; children: ReactNode }): JSX.Element {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-xl bg-warmGray/[0.06] p-4', grow)}>
      <p className="text-sm font-semibold text-charcoal">{title}</p>
      {children}
    </div>
  );
}

// Số liệu xếp ngang (thiếu chỗ thì xuống dòng): nhãn nhỏ trên, số đậm dưới
function Figures({ facts }: { facts: ReportFact[] }): JSX.Element {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3">
      {facts.map(fact => (
        <div key={fact.label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-warmGray">{fact.label}</dt>
          <dd className="text-lg font-bold text-charcoal">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface HealthReportViewProps {
  report: HouseHealthReport;
  onDownload: () => void;
  isDownloading: boolean;
}

/**
 * EXPERT-FR-005, 006 — 1 báo cáo theo nhà, rộng hết trang: tóm tắt (trạng thái, đàn chim, thời tiết cạnh nhau) → kết luận chuyên gia
 * → các ngày → theo Zone. Cùng số liệu với PDF (healthReport.utils.ts).
 */
export default function HealthReportView({ report, onDownload, isDownloading }: HealthReportViewProps): JSX.Element {
  const { t, date, dateTime, exact } = useTranslation(healthDict);
  const format = useMemo(() => ({ t, date, dateTime, number: (value: number) => exact(value, 1) }), [t, date, dateTime, exact]);
  const dayRows = useMemo(() => reportDayRows(report, format), [report, format]);
  const zones = useMemo(() => report.zone_sections.map(section => zoneFacts(section, format)), [report, format]);
  const weather = weatherFacts(report, format);
  const incomplete = incompleteDayCount(report);
  const total = REPORT_STATUSES.reduce((sum, status) => sum + (report.status_counts[status] ?? 0), 0) + report.hidden_days;

  return (
    <article className="flex w-full flex-col gap-6 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-warmGray">
            {t('report.title')} · {t(`kindLong.${report.kind}`)}
          </p>
          <h1 className="text-h1 text-charcoal">{report.house_name} · {reportPeriod(report, format)}</h1>
          <p className="text-xs text-warmGray">{t('rd.generatedAt', { time: dateTime(report.generated_at) })}</p>
        </div>
        <Button variant="secondary" size="sm" loading={isDownloading} onClick={onDownload}>
          <FilePdfIcon size={16} weight="bold" aria-hidden />
          {t('action.pdf')}
        </Button>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-4">
          {/* Thanh chia theo số ngày mỗi trạng thái; ngày bị che (BR-31) là phần trắng cuối thanh */}
          <Group title={t('rd.statusCounts')} grow="flex-[2_1_22rem]">
            <div className="flex h-3 overflow-hidden rounded-full bg-white" aria-hidden>
              {total > 0 && REPORT_STATUSES.map(status => {
                const count = report.status_counts[status] ?? 0;
                return count > 0 ? <span key={status} className={STATUS_BAR[status]} style={{ width: `${(count / total) * 100}%` }} /> : null;
              })}
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {REPORT_STATUSES.map(status => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_BAR[status])} aria-hidden />
                  <dt className="text-warmGray">{t(`status.${status}`)}</dt>
                  <dd className="font-semibold text-charcoal">{report.status_counts[status] ?? 0}</dd>
                </div>
              ))}
            </dl>
            {report.hidden_days > 0 && <p className="text-xs text-warmGray">{t('rd.hiddenDays', { n: report.hidden_days })}</p>}
          </Group>
          <Group title={t('rd.flock')} grow="flex-[1_1_16rem]">
            <Figures
              facts={[
                {
                  label: t('rd.avgReturn'),
                  value: report.house_metrics.avg_return_rate === null ? NO_VALUE : `${format.number(report.house_metrics.avg_return_rate)} %`,
                },
                { label: t('rd.incompleteTile'), value: String(incomplete) },
              ]}
            />
            {incomplete > 0 && <p className="text-xs text-warmGray">{t('rd.incompleteDays', { n: incomplete })}</p>}
          </Group>
          <Group title={t('detail.weather')} grow="flex-[2_1_22rem]">
            {weather ? <Figures facts={weather} /> : <p className="text-sm text-warmGray">{t('detail.weatherNone')}</p>}
          </Group>
        </div>
        <p className="text-xs italic text-warmGray">{t('detail.disclaimer')}</p>
      </section>

      <Part title={t('rd.conclusion')}>
        {report.expert_conclusion ? (
          <blockquote className="flex flex-col gap-2 border-l-4 border-limeMist pl-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-charcoal">{report.expert_conclusion.text}</p>
            <footer className="text-xs text-warmGray">
              {report.expert_conclusion.by.full_name ?? NO_VALUE} · {dateTime(report.expert_conclusion.at)}
              {report.expert_conclusion.edited_at && ` · ${t('rd.edited', { time: dateTime(report.expert_conclusion.edited_at) })}`}
            </footer>
          </blockquote>
        ) : (
          <p className="text-sm italic text-warmGray">{t('rd.noConclusion')}</p>
        )}
      </Part>

      {/* Mỗi ngày 1 dòng: ngày · trạng thái · chim về | lý do | các đánh giá — thẻ rộng thì 3 phần nằm ngang, hẹp thì tự xuống dòng */}
      <Part title={t('rd.days')}>
        <ol className="flex flex-col">
          {dayRows.map(row => (
            <li key={row.date} className="flex flex-wrap gap-x-8 gap-y-2 border-b border-warmGray/15 py-3 text-sm last:border-b-0">
              <div className="flex flex-[0_0_22rem] flex-wrap items-center gap-x-4 gap-y-1">
                <span className="w-24 font-semibold text-charcoal">{row.date}</span>
                <span className="w-28">
                  {row.status
                    ? <HealthStatusBadge status={row.status} className="whitespace-nowrap" />
                    : <span className="italic text-warmGray">{row.statusText}</span>}
                </span>
                <span className="text-warmGray">
                  {t('rd.returnRate')} <span className="font-semibold text-charcoal">{row.returnRate}</span>
                </span>
              </div>
              <div className="min-w-0 flex-[1_1_18rem]">
                {row.reasons.length > 0 ? (
                  <ul className="flex list-disc flex-col gap-1 pl-4 text-charcoal" aria-label={t('detail.reasons')}>
                    {row.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                  </ul>
                ) : <span className="text-warmGray">{NO_VALUE}</span>}
              </div>
              <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1 text-graphite" aria-label={t('detail.ratings')}>
                {row.ratings.length > 0
                  ? row.ratings.map((rating, index) => <p key={index}>{rating}</p>)
                  : <span className="text-warmGray">{NO_VALUE}</span>}
              </div>
            </li>
          ))}
        </ol>
      </Part>

      {/* So sánh các Zone: hàng = chỉ số, cột = Zone; nhiều Zone thì cuộn ngang trong khung */}
      <Part title={t('rd.zones')}>
        {zones.length === 0 ? (
          <p className="text-sm text-warmGray">{t('rd.noZones')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${14 + zones.length * 11}rem` }}>
              <thead>
                <tr className="border-b border-warmGray/30">
                  <th className="py-2 pr-4 text-left" scope="col"><span className="sr-only">{t('rd.zones')}</span></th>
                  {report.zone_sections.map(section => (
                    <th key={section.zone_id} className="px-3 py-2 text-left align-bottom" scope="col">
                      <span className="block font-semibold text-charcoal">{section.zone_name}</span>
                      <span className="block text-xs font-normal text-warmGray">{t('rd.samples', { n: section.sample_count })}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones[0].map((fact, row) => (
                  <tr key={fact.label} className="border-b border-warmGray/15 last:border-b-0">
                    <th className="py-2.5 pr-4 text-left font-normal text-warmGray" scope="row">{fact.label}</th>
                    {zones.map((zone, column) => (
                      <td key={report.zone_sections[column].zone_id} className="px-3 py-2.5 align-top font-semibold text-charcoal">{zone[row].value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Part>
    </article>
  );
}
