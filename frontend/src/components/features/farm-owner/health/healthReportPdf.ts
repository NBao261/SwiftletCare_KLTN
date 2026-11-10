import type { jsPDF as JsPdf } from 'jspdf';

import {
  REPORT_STATUSES, incompleteDayCount, reportDayRows, reportPeriod, weatherFacts, zoneFacts, zoneHeader,
  type ReportFact, type ReportFormat,
} from '@/components/features/farm-owner/health/healthReport.utils';
import { NO_VALUE } from '@/constants/display';
import type { HouseHealthReport } from '@/types';

// Font mặc định của jsPDF không có dấu tiếng Việt — nhúng Plus Jakarta Sans (font của web, OFL) từ public/fonts
const FONT = 'PlusJakartaSans';
const FONT_FILES = { normal: 'PlusJakartaSans-Regular.ttf', bold: 'PlusJakartaSans-Bold.ttf' } as const;
const MARGIN = 14;
const ZONES_PER_TABLE = 3;
const CHARCOAL: [number, number, number] = [38, 38, 38];
const GRAY: [number, number, number] = [120, 120, 120];
const LINE: [number, number, number] = [220, 220, 220];

async function fontBase64(file: string): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  if (!response.ok) throw new Error(`font ${file}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Ghép theo khối: String.fromCharCode(...bytes) cả file sẽ tràn stack
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

// EXPERT-FR-013 — PDF có đúng số trên màn (cùng healthReport.utils), không in id nội bộ; ngày chưa đánh giá vẫn che (BR-31)
export async function downloadHealthReportPdf(report: HouseHealthReport, format: ReportFormat): Promise<void> {
  // Tải thư viện và font lúc bấm, không nằm trong bundle đầu
  const [{ jsPDF }, { default: autoTable }, regular, bold] = await Promise.all([
    import('jspdf'),
    // Bản ESM: lối vào mặc định của gói là bản UMD
    import('jspdf-autotable/es'),
    fontBase64(FONT_FILES.normal),
    fontBase64(FONT_FILES.bold),
  ]);
  const { t } = format;
  const doc: JsPdf = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS(FONT_FILES.normal, regular);
  doc.addFont(FONT_FILES.normal, FONT, 'normal');
  doc.addFileToVFS(FONT_FILES.bold, bold);
  doc.addFont(FONT_FILES.bold, FONT, 'bold');
  // Dấu tiếng Việt cao hơn chữ Latin — giãn dòng để dấu không chạm dòng trên (autoTable cũng đọc hệ số này)
  doc.setLineHeightFactor(1.35);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  // Đoạn chữ tự xuống dòng, sang trang khi hết chỗ
  function text(value: string, options: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}): void {
    const size = options.size ?? 10;
    doc.setFont(FONT, options.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? CHARCOAL));
    const lineHeight = size * 0.48;
    for (const line of doc.splitTextToSize(value, contentWidth) as string[]) {
      if (y + lineHeight > pageHeight - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      y += lineHeight;
      doc.text(line, MARGIN, y);
    }
    y += options.gap ?? 1.5;
  }

  function heading(value: string): void {
    // Không để tiêu đề nằm một mình cuối trang
    if (y + 20 > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    y += 4;
    text(value, { size: 12, bold: true, gap: 2 });
  }

  const tableStyle = {
    margin: { left: MARGIN, right: MARGIN },
    // Một dòng không bị cắt đôi qua 2 trang
    rowPageBreak: 'avoid' as const,
    styles: { font: FONT, fontSize: 9, textColor: CHARCOAL, lineColor: LINE, lineWidth: 0.2, cellPadding: 1.8 },
    headStyles: { font: FONT, fontStyle: 'bold' as const, fillColor: [245, 245, 245] as [number, number, number], textColor: CHARCOAL },
  };

  function factsTable(facts: ReportFact[]): void {
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      body: facts.map(fact => [fact.label, fact.value]),
      columnStyles: { 0: { cellWidth: 60, textColor: GRAY } },
      theme: 'grid',
    });
    y = (doc as JsPdf & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  }

  // Đầu trang
  text(t('pdf.title'), { size: 16, bold: true, gap: 2 });
  text(`${report.house_name} · ${t(`kind.${report.kind}`)} · ${reportPeriod(report, format)}`, { size: 11, gap: 1 });
  text(t('rd.generatedAt', { time: format.dateTime(report.generated_at) }), { size: 9, color: GRAY });
  text(t('detail.disclaimer'), { size: 9, color: GRAY });

  heading(t('rd.statusCounts'));
  // Mỗi trạng thái 1 dòng (bảng 2 cột như Thời tiết) thay vì nối trên 1 dòng chữ
  factsTable(REPORT_STATUSES.map(status => ({ label: t(`status.${status}`), value: String(report.status_counts[status] ?? 0) })));
  if (report.hidden_days > 0) text(t('rd.hiddenDays', { n: report.hidden_days }), { size: 9, color: GRAY });

  heading(t('rd.flock'));
  const average = report.house_metrics.avg_return_rate;
  text(`${t('rd.avgReturn')}: ${average === null ? NO_VALUE : `${format.number(average)} %`}`);
  const incomplete = incompleteDayCount(report);
  if (incomplete > 0) text(t('rd.incompleteDays', { n: incomplete }), { size: 9, color: GRAY });

  heading(t('detail.weather'));
  const weather = weatherFacts(report, format);
  if (weather) factsTable(weather);
  else text(t('detail.weatherNone'));

  heading(t('rd.conclusion'));
  const conclusion = report.expert_conclusion;
  if (conclusion) {
    text(conclusion.text);
    const edited = conclusion.edited_at ? ` · ${t('rd.edited', { time: format.dateTime(conclusion.edited_at) })}` : '';
    text(`${conclusion.by.full_name ?? NO_VALUE} · ${format.dateTime(conclusion.at)}${edited}`, { size: 9, color: GRAY });
  } else {
    text(t('rd.noConclusion'));
  }

  heading(t('rd.days'));
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [[t('col.date'), t('col.status'), t('rd.returnRate'), t('detail.reasons'), t('detail.ratings')]],
    body: reportDayRows(report, format).map(row => [
      row.date,
      row.statusText,
      row.returnRate,
      row.reasons.join('\n') || NO_VALUE,
      row.ratings.join('\n') || NO_VALUE,
    ]),
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 24 }, 2: { cellWidth: 26 } },
    theme: 'grid',
  });
  y = (doc as JsPdf & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  // Bảng so sánh như màn hình: hàng = chỉ số, cột = Zone; tối đa 3 Zone/bảng để chữ không bị bóp (A4 dọc), nhiều hơn thì thêm bảng
  heading(t('rd.zones'));
  if (report.zone_sections.length === 0) text(t('rd.noZones'));
  for (let start = 0; start < report.zone_sections.length; start += ZONES_PER_TABLE) {
    const group = report.zone_sections.slice(start, start + ZONES_PER_TABLE);
    const facts = group.map(section => zoneFacts(section, format));
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [[t('rd.indicator'), ...group.map(section => zoneHeader(section, format))]],
      body: facts[0].map((fact, row) => [fact.label, ...facts.map(zone => zone[row].value)]),
      columnStyles: { 0: { cellWidth: 55, textColor: GRAY } },
      theme: 'grid',
    });
    y = (doc as JsPdf & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  }

  // Số trang ở chân mọi trang
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(t('pdf.page', { page, total }), pageWidth - MARGIN, pageHeight - 6, { align: 'right' });
  }

  doc.save(`bao-cao-suc-khoe-${report.period_start}_${report.period_end}.pdf`);
}
