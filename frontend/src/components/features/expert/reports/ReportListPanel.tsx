/**
 * ReportListPanel — Cột trái Master list báo cáo tuần (340px)
 * Nút Preview + Danh sách kỳ báo cáo đã chốt | SRS v2.1.4: EXPERT-FR-005
 */
import { Zap, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ZoneHealthReportItem } from '@/types/expert.types'
import { getWeekLabel } from '@/hooks/expert/useHealthReports'

interface Props {
  reports: ZoneHealthReportItem[]
  selectedId: string | null
  previewMode: boolean
  isLoading: boolean
  onSelect: (id: string) => void
  onPreview: () => void
}

function ReportCard({ report, index, selected, onClick }: {
  report: ZoneHealthReportItem; index: number; selected: boolean; onClick: () => void
}) {
  const hasConcl = Boolean(report.expert_conclusion?.text)
  const weekLabel = getWeekLabel(report, index)
  const m = report.metrics
  const hum = m?.humidity_in_range_pct != null ? `${m.humidity_in_range_pct.toFixed(1)}%` : '—'
  const tmp = m?.temp_in_range_pct != null ? `${m.temp_in_range_pct.toFixed(1)}%` : '—'
  const authorName = typeof report.expert_conclusion?.by === 'object'
    ? report.expert_conclusion.by?.full_name
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3.5 rounded-xl border-2 transition-all duration-150 space-y-1.5',
        selected
          ? 'border-[#27231F] bg-white shadow-md'
          : 'border-neutral-100 bg-neutral-50/60 hover:border-neutral-300 hover:bg-white',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-[#27231F] leading-tight">{weekLabel}</p>
        {hasConcl ? (
          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#B5D32C] text-[#27231F]">
            Đã xuất bản
          </span>
        ) : (
          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFFA9] text-[#4A5C00] border border-[#B5D32C]">
            Chờ kết luận
          </span>
        )}
      </div>

      <p className="text-[11px] text-[#878380]">
        {hasConcl && authorName ? `bởi ${authorName}` : `Kỳ chốt tuần ${42 - index}`}
      </p>

      {/* KPI snapshot */}
      <div className="flex items-center gap-2 text-[11px] text-[#878380] pt-0.5">
        <span>Độ ẩm: <b className="text-[#27231F]">{hum}</b></span>
        <span className="text-neutral-300">•</span>
        <span>Nhiệt độ: <b className="text-[#27231F]">{tmp}</b></span>
      </div>
    </button>
  )
}

export default function ReportListPanel({
  reports, selectedId, previewMode, isLoading, onSelect, onPreview,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 flex flex-col gap-3 w-full">
      {/* Nút Xem số liệu tạm tính (Preview) */}
      <button
        type="button"
        onClick={onPreview}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-150',
          previewMode
            ? 'bg-[#27231F] text-[#ECFFA9] shadow-md ring-2 ring-[#B5D32C]'
            : 'bg-[#ECFFA9] text-[#27231F] border border-[#B5D32C] hover:bg-[#B5D32C] hover:text-white',
        )}
      >
        <Zap className="w-4 h-4 flex-shrink-0" />
        <span>Xem số liệu tạm tính tuần này (Preview)</span>
      </button>

      <div className="flex items-center justify-between text-[11px] text-[#878380] px-1">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Tự động chốt lúc 00:05 Thứ Hai
        </span>
      </div>

      {/* Tiêu đề phân cách danh sách kỳ báo cáo đã chốt */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 px-1">
        <span className="text-[11px] font-bold text-[#878380] uppercase tracking-wider">
          Kỳ báo cáo đã chốt
        </span>
      </div>

      {/* Danh sách thẻ báo cáo */}
      {isLoading ? (
        <div className="space-y-2.5 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-neutral-100 rounded-xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="p-4 text-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50">
          <p className="text-xs font-semibold text-[#27231F]">Chưa có kỳ báo cáo nào</p>
          <p className="text-[11px] text-[#878380] mt-1">
            Bấm &quot;Xem số liệu tạm tính&quot; phía trên để tổng hợp tuần này.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reports.slice(0, 4).map((report, i) => (
            <ReportCard
              key={report._id}
              report={report}
              index={i}
              selected={!previewMode && (selectedId === report._id || (!selectedId && i === 0))}
              onClick={() => onSelect(report._id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
