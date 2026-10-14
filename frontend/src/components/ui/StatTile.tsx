import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'

interface StatTileProps {
  icon: Icon
  /** Màu vòng tròn icon — nơi duy nhất mang màu của ô (VD cùng màu badge trạng thái trong bảng) */
  iconClass: string
  label: string
  value: string | number
  sub: string
  className?: string
  /** Nhãn nền đỏ cùng hàng số lớn, sát mép phải (VD "115 quá hạn" ở ô Ticket đang mở) */
  valueBadge?: string
}

/**
 * Ô chỉ số ở hàng KPI các trang Admin — cùng kiểu ReadingTile ở Dashboard Farm Owner (EnvSensorPanel):
 * nền trắng, nhãn trái + icon tròn phải, số lớn, 1 dòng phụ. Mọi ô cùng tầng nên các tầng thẳng hàng
 * ngang giữa các ô.
 */
export default function StatTile({ icon: TileIcon, iconClass, label, value, sub, className, valueBadge }: StatTileProps) {
  // Không tô đỏ/cam cả ô theo trạng thái — tốt/xấu ghi bằng chữ ở dòng phụ (VD "Dưới mục tiêu 80%")
  return (
    <div className={cn('flex flex-col rounded-2xl border border-warmGray/15 bg-white p-3.5 shadow-card', className)}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        {/* Xuống dòng thay vì cắt "…" — ô hẹp (mobile 2×2) vẫn đọc đủ nhãn */}
        <span className="min-w-0 text-small font-semibold text-warmGray">{tr(label)}</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', iconClass)}>
          {/* Nét regular cho gần nét mảnh (stroke 1.6) của icon ReadingTile ở Dashboard Farm Owner */}
          <TileIcon size={14} weight="regular" />
        </span>
      </div>
      {/* Nhãn đỏ cùng hàng số, dạt sát phải; flex-wrap: ô quá hẹp thì nhãn xuống dòng thay vì tràn khỏi ô */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {/* Cỡ chữ gọn: nhãn 13px · số 24px · dòng phụ 12px */}
        <p className="text-2xl font-extrabold leading-none tracking-tight text-charcoal">
          {tr(value)}
        </p>
        {valueBadge && (
          <span className="whitespace-nowrap rounded-full bg-alertRed px-2 py-0.5 text-xs font-semibold text-white">
            {tr(valueBadge)}
          </span>
        )}
      </div>
      {/* Dòng phụ xuống dòng khi ô hẹp thay vì cắt "…" — grid kéo các ô cùng hàng cao bằng nhau */}
      <p className="mt-1.5 text-xs font-medium text-warmGray">{tr(sub)}</p>
    </div>
  )
}
