import { useMemo, type ReactNode } from 'react';

import {
  BirdIcon, CalendarDotsIcon, CalendarXIcon, CloudRainIcon, DropIcon, FilePdfIcon, HouseIcon, ThermometerSimpleIcon, type Icon,
} from '@phosphor-icons/react';
import HealthStatusBadge from '@/components/features/farm-owner/health/HealthStatusBadge';
import { vietnamDate } from '@/components/features/farm-owner/health/healthDay.utils';
import {
  REPORT_STATUSES, incompleteDayCount, reportDayRows, reportPeriod, weatherFacts, zoneFacts, type ReportFact,
} from '@/components/features/farm-owner/health/healthReport.utils';
import { Button } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { HouseHealthReport } from '@/types';

// Cùng thứ tự weatherFacts: nhiệt độ, độ ẩm TB, lượng mưa, số ngày mưa
const WEATHER_ICONS: Icon[] = [ThermometerSimpleIcon, DropIcon, CloudRainIcon, CalendarDotsIcon];

// Bảng các ngày: hàng tiêu đề và từng dòng dùng chung độ rộng 3 phần để thẳng cột
const DAY_ROW = 'flex flex-wrap gap-x-8 gap-y-2';
const DAY_MAIN = 'flex-[0_0_22rem]';
const DAY_REASONS = 'min-w-0 flex-[1_1_18rem]';
const DAY_RATINGS = 'min-w-0 flex-[1_1_16rem]';

// Một mục của trang: tiêu đề + nội dung, nét kẻ mảnh ngăn các mục
function Part({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-4 border-t border-warmGray/15 pt-6">
      <h2 className="text-h2 text-charcoal">{title}</h2>
      {children}
    </section>
  );
}

// Ô nền xám nhạt của phần tóm tắt; grow = phần chiều ngang khi nằm cạnh ô khác (hẹp thì tự xuống hàng theo độ rộng thẻ)
function Group({ title, grow, children }: { title: string; grow: string; children: ReactNode }): JSX.Element {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-xl bg-warmGray/[0.06] p-4', grow)}>
      <p className="text-sm font-semibold text-charcoal">{title}</p>
      {children}
    </div>
  );
}

// Số liệu trong 1 hàng, các cột rộng đều nên số thẳng hàng; thiếu chỗ thì cột tự xuống dòng
// icons cùng thứ tự facts: icon nhỏ xám trước nhãn để nhìn lướt nhận ra số
function Figures({ facts, icons }: { facts: ReportFact[]; icons: Icon[] }): JSX.Element {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-6 gap-y-3">
      {facts.map((fact, index) => {
        const FactIcon = icons[index];
        return (
          <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-xs text-warmGray">
              {FactIcon && <FactIcon size={14} weight="bold" className="shrink-0" aria-hidden />}
              {fact.label}
            </dt>
            <dd className="whitespace-nowrap text-lg font-bold text-charcoal">{fact.value}</dd>
          </div>
        );
      })}
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
  const { t, date, dateTime, hourMinute, exact } = useTranslation(healthDict);
  const format = useMemo(() => ({ t, date, dateTime, number: (value: number) => exact(value, 1) }), [t, date, dateTime, exact]);
  const dayRows = useMemo(() => reportDayRows(report, format), [report, format]);
  const zones = useMemo(() => report.zone_sections.map(section => zoneFacts(section, format)), [report, format]);
  const weather = weatherFacts(report, format);
  const incomplete = incompleteDayCount(report);
  // Báo cáo tạo trong ngày cuối kỳ (VD báo cáo ngày lúc 19:25) chỉ ghi giờ để khỏi lặp ngày
  const generatedAt = vietnamDate(new Date(report.generated_at)) === report.period_end ? hourMinute(report.generated_at) : dateTime(report.generated_at);

  return (
    <article className="flex w-full flex-col gap-6 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card sm:p-6">
      {/* Tên nhà là tiêu đề (dài thì "…", rê chuột xem đủ); loại báo cáo, kỳ, giờ tạo chữ nhạt ở dòng dưới; nút PDF ở góc phải */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="flex min-w-0 items-center gap-2 text-h1 text-charcoal">
            <HouseIcon size={28} weight="bold" className="shrink-0" aria-hidden />
            <span title={report.house_name} className="truncate">{report.house_name}</span>
          </h1>
          <p className="text-base font-semibold text-warmGray">
            {t(`kindTitle.${report.kind}`)} · {reportPeriod(report, format)} · {t('rd.generatedAt', { time: generatedAt })}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="shrink-0" loading={isDownloading} onClick={onDownload}>
          <FilePdfIcon size={16} weight="bold" aria-hidden />
          {t('action.pdf')}
        </Button>
      </header>

      <section className="flex flex-col gap-4">
        {/* Một hàng gọn: badge trạng thái (cùng màu bảng ngày) + số ngày; số 0 chữ xám nhạt để số khác 0 nổi lên */}
        <div className="flex flex-wrap gap-4">
          <Group title={t('rd.statusCounts')} grow="flex-[3_1_28rem]">
            <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {REPORT_STATUSES.map(status => {
                const count = report.status_counts[status] ?? 0;
                return (
                  <div key={status} className="flex items-center gap-2">
                    <dt><HealthStatusBadge status={status} className="whitespace-nowrap" /></dt>
                    <dd className={cn('text-base', count > 0 ? 'font-bold text-charcoal' : 'text-warmGray')}>{count}</dd>
                  </div>
                );
              })}
            </dl>
            {report.hidden_days > 0 && <p className="text-xs text-warmGray">{t('rd.hiddenDays', { n: report.hidden_days })}</p>}
          </Group>
          <Group title={t('rd.flock')} grow="flex-[2_1_20rem]">
            <Figures
              facts={[
                {
                  label: t('rd.avgReturn'),
                  value: report.house_metrics.avg_return_rate === null ? NO_VALUE : `${format.number(report.house_metrics.avg_return_rate)} %`,
                },
                { label: t('rd.incompleteTile'), value: String(incomplete) },
              ]}
              icons={[BirdIcon, CalendarXIcon]}
            />
            {incomplete > 0 && <p className="text-xs text-warmGray">{t('rd.incompleteDays', { n: incomplete })}</p>}
          </Group>
        </div>
        <Group title={t('detail.weather')} grow="">
          {weather ? <Figures facts={weather} icons={WEATHER_ICONS} /> : <p className="text-sm text-warmGray">{t('detail.weatherNone')}</p>}
        </Group>
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

      {/* Mỗi ngày 1 dòng: ngày · trạng thái · chim về | lý do hệ thống | đánh giá của người — thẻ rộng thì 3 phần nằm ngang
          dưới hàng tiêu đề, hẹp thì tự xuống dòng (ẩn hàng tiêu đề vì không còn thẳng cột) */}
      <Part title={t('rd.days')}>
        <div className={cn(DAY_ROW, 'hidden border-b border-warmGray/30 pb-2 text-xs font-semibold text-warmGray md:flex')}>
          <span className={DAY_MAIN}>{t('rd.colDayStatus')}</span>
          <span className={DAY_REASONS}>{t('detail.reasons')}</span>
          <span className={DAY_RATINGS}>{t('rd.colRatings')}</span>
        </div>
        <ol className="flex flex-col">
          {dayRows.map(row => (
            <li key={row.date} className="flex flex-col gap-2 border-b border-warmGray/15 py-3 text-sm last:border-b-0">
              <div className={DAY_ROW}>
                {/* Cùng bố cục cột đánh giá: hàng 1 "Hệ thống" + trạng thái ngay cạnh; hàng 2 lúc tính; hàng 3 tỷ lệ chim về */}
                <div className={cn(DAY_MAIN, 'flex flex-col gap-0.5')}>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-charcoal">{t('rd.system')}</span>
                    {row.status
                      ? <HealthStatusBadge status={row.status} className="shrink-0 whitespace-nowrap" />
                      : <span className="shrink-0 text-xs italic text-warmGray">{row.statusText}</span>}
                  </div>
                  <span className="text-xs text-warmGray">{t('rd.computedAt', { time: dateTime(row.computedAt) })}</span>
                  <span className="text-xs font-semibold text-charcoal">
                    {t('rd.returnRate')} {row.returnRate}
                  </span>
                </div>
                <div className={DAY_REASONS}>
                  {row.reasons.length > 0 ? (
                    <ul className="flex list-disc flex-col gap-1 pl-4 text-charcoal" aria-label={t('detail.reasons')}>
                      {row.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                    </ul>
                  ) : <span className="text-warmGray">{NO_VALUE}</span>}
                </div>
                {/* Người · vai trò · lúc đánh giá (cùng ngày chỉ giờ phút), badge mức họ chọn (bỏ qua: chữ xám), ghi chú dòng dưới */}
                <div className={cn(DAY_RATINGS, 'flex flex-col gap-2')} aria-label={t('detail.ratings')}>
                  {row.ratingItems.length > 0 ? row.ratingItems.map((item, index) => (
                    <div key={index} className="flex flex-col gap-0.5">
                      {/* Hàng 1: tên, mức đánh giá ngay cạnh; hàng 2: vai trò · ngày giờ đánh giá; ghi chú dưới cùng */}
                      <div className="flex items-center gap-3">
                        <span title={item.name} className="min-w-0 truncate font-semibold text-charcoal">{item.name}</span>
                        {item.rating
                          ? <HealthStatusBadge status={item.rating} className="shrink-0 whitespace-nowrap" />
                          : <span className="shrink-0 text-xs italic text-warmGray">{t('detail.skipped')}</span>}
                      </div>
                      <span className="text-xs text-warmGray">{item.role} · {dateTime(item.at)}</span>
                      {item.note && <p className="text-xs text-graphite">{item.note}</p>}
                    </div>
                  )) : <span className="text-warmGray">{NO_VALUE}</span>}
                </div>
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
                  <th className="py-2 pr-4 text-left align-bottom font-semibold text-warmGray" scope="col">{t('rd.indicator')}</th>
                  {report.zone_sections.map(section => (
                    <th key={section.zone_id} className="px-3 py-2 text-left align-bottom" scope="col">
                      {/* Một dòng: "Tầng 1 (288 mẫu)" như zoneHeader của PDF */}
                      <span className="font-semibold text-charcoal">{section.zone_name}</span>
                      <span className="font-normal text-warmGray"> ({t('rd.samples', { n: section.sample_count })})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones[0].map((fact, row) => (
                  <tr key={fact.label} className="border-b border-warmGray/15 last:border-b-0">
                    <th className="whitespace-nowrap py-2.5 pr-6 text-left font-normal text-warmGray" scope="row">{fact.label}</th>
                    {zones.map((zone, column) => (
                      <td
                        key={report.zone_sections[column].zone_id}
                        // Hàng chữ (cảnh báo, lỗi): mỗi loại 1 dòng; "—" xám khi không có gì
                        className={cn('whitespace-pre-line px-3 py-2.5 align-top font-semibold', zone[row].value === NO_VALUE ? 'text-warmGray' : 'text-charcoal')}
                      >
                        {zone[row].value}
                      </td>
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
