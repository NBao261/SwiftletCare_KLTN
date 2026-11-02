/**
 * DomainExpertReportsPage — Báo cáo & Kết luận
 *
 * Rename + re-bucket từ ExpertReportsPage:
 *   Cũ: pages/expert/ExpertReportsPage.tsx  →  /expert/reports
 *   Mới: pages/domain-expert/DomainExpertReportsPage.tsx  →  /domain-expert/reports
 *
 * Layout Master-Detail 2 cột: list panel (340px) | detail panel.
 * SRS EXPERT-FR-005/006/007.
 * Bucket: pages/domain-expert/ — §12.4.
 */
import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import MockDataTooltip from '@/components/shared/MockDataTooltip';
import ReportListPanel from '@/components/features/domain-expert/reports/ReportListPanel';
import HealthMetricsGrid from '@/components/features/domain-expert/reports/HealthMetricsGrid';
import ExpertConclusionEditor from '@/components/features/domain-expert/reports/ExpertConclusionEditor';
import {
  useHealthReportList, useHealthReportPreview,
  usePublishConclusion, useReportSelection, formatPeriodLabel, formatGeneratedAt,
} from '@/hooks/domain-expert/useHealthReports';

function Toast({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 bg-[#27231F] text-[#ECFFA9]">
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
  const { selectedZoneId, selectedZoneName } = useZoneStore();
  const zoneId = selectedZoneId ?? undefined;
  const zoneName = selectedZoneName || 'Phía Sau';
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  };

  const { data: reports = [], isLoading: loadingList } = useHealthReportList(zoneId);
  const { selectedId, setSelectedId, selected, previewMode, setPreviewMode } = useReportSelection(reports);
  const { data: previewReport, isLoading: loadingPreview } = useHealthReportPreview(zoneId, previewMode);
  const activeReport = previewMode ? (previewReport ?? null) : selected;

  const publishMutation = usePublishConclusion(activeReport?._id ?? '');

  const samplesCount = activeReport?.metrics?.sample_count ?? 0;
  const period = activeReport ? formatPeriodLabel(activeReport) : '12/10/2026 – 18/10/2026';

  return (
    <div className="relative w-full flex-1 flex flex-col gap-5">
      <div className="w-full max-w-screen-xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-5 items-start">
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
      </div>
      <Toast show={toast.show} message={toast.message} />
    </div>
  );
}
