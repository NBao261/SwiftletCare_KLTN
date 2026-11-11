/**
 * DomainExpertReportsPage — Báo cáo & Kết luận + Xem Ngày Đánh Giá Lệch (EXPERT-FR-005/006/007, EXPERT-FR-022, BR-28)
 *
 * Rename + re-bucket từ ExpertReportsPage:
 *   Cũ: pages/expert/ExpertReportsPage.tsx  →  /expert/reports
 *   Mới: pages/domain-expert/DomainExpertReportsPage.tsx  →  /domain-expert/reports
 *
 * Hỗ trợ 2 phân hệ qua URL query (?tab=disagreements):
 *   - Tab 1 (mặc định): Báo cáo & Kết luận định kỳ (Layout Master-Detail 2 cột: list panel 340px | detail panel)
 *   - Tab 2 (?tab=disagreements): Xem Ngày Đánh Giá Lệch & Chỉnh Mức Chỉ Số Nhà Yến (EXPERT-FR-022, BR-28)
 *
 * Bucket: pages/domain-expert/ — §12.4.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Check, FileText, Scale } from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import MockDataTooltip from '@/components/shared/MockDataTooltip';
import ReportListPanel from '@/components/features/domain-expert/reports/ReportListPanel';
import HealthMetricsGrid from '@/components/features/domain-expert/reports/HealthMetricsGrid';
import ExpertConclusionEditor from '@/components/features/domain-expert/reports/ExpertConclusionEditor';
import DisagreementsSection from '@/components/features/domain-expert/reports/DisagreementsSection';
import { shiftDate, vietnamDate } from '@/components/features/farm-owner/health/healthDay.utils';
import { useHealthDisagreements } from '@/hooks/domain-expert/useHealthDisagreements';
import {
  useHealthReportList, useHealthReportPreview,
  usePublishConclusion, useReportSelection, formatPeriodLabel, formatGeneratedAt,
} from '@/hooks/domain-expert/useHealthReports';

type ReportsPageTab = 'reports' | 'disagreements';

function Toast({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 bg-[#27231F] text-[#ECFFA9]">
      <Check className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  );
}

function ReportDetailHeader({
  zoneName, previewMode, period, generatedAt, samplesCount,
}: {
  zoneName: string;
  previewMode: boolean;
  period: string;
  generatedAt?: string;
  samplesCount: number;
}) {
  const isEstimated = samplesCount <= 0;
  const displaySamples = isEstimated ? 2016 : samplesCount;

  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-neutral-100">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-base font-bold text-[#27231F]">
          {previewMode
            ? `Số liệu Tạm tính Tuần này — ${zoneName}`
            : `Báo cáo Sức khỏe Định kỳ — ${zoneName}`}
        </h2>
        {previewMode && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#27231F] text-[#ECFFA9]">
            Bản tạm tính Preview
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#878380]">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Chu kỳ: <b className="text-[#27231F] ml-0.5">{period}</b>
        </span>
        <span className="text-neutral-300">•</span>
        <span>Tổng hợp: <b>{formatGeneratedAt(generatedAt)}</b></span>
        <span className="text-neutral-300">•</span>
        <span className="inline-flex items-center gap-1">
          Số mẫu đo: <b className="text-[#27231F]">{displaySamples.toLocaleString()} mẫu</b>
          {isEstimated && (
            <MockDataTooltip reason="Số mẫu quy đổi ước tính trong kỳ tuần tạm tính (7 ngày x 288 mẫu/ngày)." />
          )}
        </span>
      </div>
    </div>
  );
}

export default function DomainExpertReportsPage() {
  const { selectedFarmId, selectedZoneId, selectedZoneName } = useZoneStore();
  const zoneId = selectedZoneId ?? undefined;
  const zoneName = selectedZoneName || 'Phía Sau';
  const [toast, setToast] = useState({ show: false, message: '' });
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: ReportsPageTab =
    searchParams.get('tab') === 'disagreements' ? 'disagreements' : 'reports';

  const setTab = (tab: ReportsPageTab) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (tab === 'reports') next.delete('tab');
        else next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  };

  const { data: reports = [], isLoading: loadingList } = useHealthReportList(zoneId);
  const { selectedId, setSelectedId, selected, previewMode, setPreviewMode } = useReportSelection(reports);
  const { data: previewReport, isLoading: loadingPreview } = useHealthReportPreview(zoneId, previewMode);
  const activeReport = previewMode ? (previewReport ?? null) : selected;

  // Đếm số ngày lệch trong 14 ngày gần nhất của trang trại để hiển thị badge trên Tab (EXPERT-FR-022)
  const to = vietnamDate();
  const from = shiftDate(to, -13);
  const { totalDays: disagreeingDaysCount } = useHealthDisagreements({
    farmId: selectedFarmId ?? undefined,
    from,
    to,
  });

  const publishMutation = usePublishConclusion(activeReport?._id ?? '');

  const samplesCount = activeReport?.metrics?.sample_count ?? 0;
  const period = activeReport ? formatPeriodLabel(activeReport) : '12/10/2026 – 18/10/2026';
  const pendingReportsCount = reports.filter(r => !r.expert_conclusion?.text).length;

  return (
    <div className="relative z-10 w-full flex-1 flex flex-col gap-5">
      <div className="w-full max-w-screen-xl mx-auto flex flex-col gap-5">
        {/* Thanh chuyển phân hệ: Báo cáo & Kết luận định kỳ vs. Ngày đánh giá lệch & Mức chỉ số */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warmGray/20 bg-white px-4 py-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Phân hệ báo cáo và ngày đánh giá lệch">
            <button
              id="tab-periodic-reports"
              type="button"
              role="tab"
              aria-selected={activeTab === 'reports'}
              aria-controls="panel-periodic-reports"
              onClick={() => setTab('reports')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal ${
                activeTab === 'reports'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20 hover:text-charcoal'
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Báo cáo & Kết luận định kỳ</span>
              {pendingReportsCount > 0 && (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white">
                  {pendingReportsCount}
                </span>
              )}
            </button>

            <button
              id="tab-disagreements"
              type="button"
              role="tab"
              aria-selected={activeTab === 'disagreements'}
              aria-controls="panel-disagreements"
              onClick={() => setTab('disagreements')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal ${
                activeTab === 'disagreements'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20 hover:text-charcoal'
              }`}
            >
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ngày đánh giá lệch & Mức chỉ số</span>
              {disagreeingDaysCount > 0 && (
                <span className="rounded-full bg-amber-600 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white">
                  {disagreeingDaysCount}
                </span>
              )}
            </button>
          </div>

          <span className="text-xs text-warmGray">
            {activeTab === 'reports'
              ? 'Tổng hợp sức khỏe định kỳ và xuất bản kết luận chuyên môn gửi Chủ nhà yến'
              : 'Đối chiếu đánh giá thực địa với hệ thống và tinh chỉnh mức chỉ số sức khỏe của nhà yến'}
          </span>
        </div>

        {activeTab === 'reports' ? (
          <div
            id="panel-periodic-reports"
            role="tabpanel"
            aria-labelledby="tab-periodic-reports"
            className="flex flex-col lg:flex-row gap-5 items-start"
          >
            {/* Cột trái — 340px */}
            <div className="w-full lg:w-[340px] lg:flex-shrink-0">
              <ReportListPanel
                reports={reports}
                selectedId={selectedId}
                previewMode={previewMode}
                isLoading={loadingList}
                onSelect={id => { setSelectedId(id); setPreviewMode(false); }}
                onPreview={() => setPreviewMode(p => !p)}
              />
            </div>

            {/* Cột phải — flex-1 */}
            <div className="flex-1 min-w-0 w-full">
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 space-y-5">
                <ReportDetailHeader
                  zoneName={zoneName}
                  previewMode={previewMode}
                  period={period}
                  generatedAt={activeReport?.generated_at}
                  samplesCount={samplesCount}
                />

                <HealthMetricsGrid
                  report={activeReport}
                  isLoading={(previewMode && loadingPreview) || (!previewMode && loadingList)}
                />

                <div className="pt-2 border-t border-neutral-100">
                  <ExpertConclusionEditor
                    report={activeReport}
                    zoneName={zoneName}
                    previewMode={previewMode}
                    isSaving={publishMutation.isPending}
                    onSave={conclusion => {
                      publishMutation.mutate(conclusion, {
                        onSuccess: () => {
                          showToast(previewMode
                            ? 'Đã lưu bản nháp kết luận tạm tính thành công!'
                            : 'Đã lưu & xuất bản kết luận gửi Chủ trại thành công!');
                        },
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            id="panel-disagreements"
            role="tabpanel"
            aria-labelledby="tab-disagreements"
            className="w-full"
          >
            <DisagreementsSection />
          </div>
        )}
      </div>
      <Toast show={toast.show} message={toast.message} />
    </div>
  );
}
