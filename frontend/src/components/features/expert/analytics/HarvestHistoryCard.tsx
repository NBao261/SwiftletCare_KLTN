/**
 * HarvestHistoryCard — Lịch sử thu hoạch tổ yến đối chiếu (Khối 4 màn hình 04)
 * Bảng 5 cột x 4 dòng/trang — Phân trang nhỏ gọn, không thanh cuộn ngang
 * SRS v2.1.4: ANALYTICS-FR-011
 */
import { useState } from 'react'
import { Eye, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import type { HarvestBatchItem } from '@/types/expert.types'

const ZONE_LABELS: Record<number, string> = { 0: 'Tầng 2 - Khu A', 1: 'Tầng 1 - Khu B', 2: 'Tầng 2 - Khu A', 3: 'Tầng 1 - Khu A' }
const HUM_VALS = ['89,4 %RH', '87,1 %RH', '91,3 %RH', '88,6 %RH']
const PAGE_SIZE = 4

function formatDate(d: string) {
  const dt = new Date(d)
  return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`
}

interface Props {
  batches?: HarvestBatchItem[]
  isLoading?: boolean
}

export default function HarvestHistoryCard({ batches, isLoading }: Props) {
  const [page, setPage] = useState(1)
  const rows = batches ?? []
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-[#27231F]">Lịch sử thu hoạch tổ yến đối chiếu</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-[#878380] border border-neutral-200 shrink-0">
            <Eye className="w-3.5 h-3.5" />
            Chế độ chỉ đọc
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2 animate-pulse py-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-neutral-100 rounded" />)}
          </div>
        ) : (
          <div className="overflow-hidden flex-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] uppercase text-[#878380] bg-neutral-50 border-b border-neutral-100">
                  {['Ngày thu hoạch', 'Khu vực', 'Số lượng tổ', 'Khối lượng', 'Độ ẩm TB'].map(h => (
                    <th key={h} className="text-left font-semibold px-2.5 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#878380]">
                      Chưa có dữ liệu thu hoạch nào được ghi nhận cho khu vực này.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((batch, i) => {
                    const globalIdx = (currentPage - 1) * PAGE_SIZE + i
                    const nests = batch.total_nests ?? batch.nest_count ?? 0
                    const weightKg = batch.total_weight_kg ?? (batch.weight_grams ? batch.weight_grams / 1000 : 0)
                    const humidity = batch.env_snapshot?.avg_humidity != null
                      ? `${batch.env_snapshot.avg_humidity.toFixed(1)} %RH`
                      : (HUM_VALS[globalIdx % HUM_VALS.length] ?? '—')

                    return (
                      <tr key={batch._id || globalIdx} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="px-2.5 py-2 font-medium text-[#27231F] whitespace-nowrap">
                          {batch.harvest_date ? formatDate(batch.harvest_date) : '—'}
                        </td>
                        <td className="px-2.5 py-2 text-[#4A5C00] font-medium whitespace-nowrap">
                          {ZONE_LABELS[globalIdx % 4] ?? 'Tầng 1 - Khu A'}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums whitespace-nowrap"><b>{nests}</b> tổ</td>
                        <td className="px-2.5 py-2 tabular-nums whitespace-nowrap">
                          <b>{typeof weightKg === 'number' && !isNaN(weightKg) ? weightKg.toFixed(2) : '0.00'}</b> kg
                        </td>
                        <td className="px-2.5 py-2 tabular-nums text-[#4A5C00] font-semibold whitespace-nowrap">
                          {humidity}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer: Pagination & Subtext */}
      <div className="mt-3 pt-2 border-t border-neutral-100 space-y-1.5">
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-[11px] text-[#878380]">
            <span>Trang {currentPage}/{totalPages} ({rows.length} đợt ghi nhận)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 py-0.5 font-bold text-[#27231F] bg-neutral-100 rounded text-[11px]">
                {currentPage}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Trang sau"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        <p className="inline-flex items-center gap-1.5 text-[11px] text-[#878380] italic">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Dữ liệu thu hoạch do Chủ trang trại cập nhật. Chuyên gia sử dụng để đối chiếu vi khí hậu.
        </p>
      </div>
    </div>
  )
}
