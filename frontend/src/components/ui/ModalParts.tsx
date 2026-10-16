import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { tr, trChildren } from '@/i18n'

/**
 * Mảnh dựng popup ngang 2 cột (dùng với `<Modal size="xl" ariaLabel>` — không truyền `title` để Modal neo nút ✕
 * góc trên phải): tiêu đề + thanh ngang ngăn với thân, tiêu đề nhóm, khối nền xám, dòng tóm tắt nhãn/giá trị.
 */

/** Tiêu đề popup trải ngang + dòng mô tả + thanh ngang bên dưới; pr-12 chừa nút ✕ */
export function ModalHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-5 pr-12">
      <h2 className="truncate text-h2 text-charcoal">{tr(title)}</h2>
      {description && <p className="mt-1 text-sm text-warmGray">{tr(description)}</p>}
    </div>
  )
}

/** Tiêu đề nhóm — cùng cỡ ở 2 cột để thẳng hàng */
export const MODAL_SECTION_TITLE = 'mb-2 text-body font-semibold text-charcoal'

/** Nhóm: tiêu đề + khối nền xám bo góc có viền mảnh (`padded=false` khi bên trong là các dòng chia vạch) */
export function ModalSection({ title, children, padded = true, className }: {
  title?: string; children: ReactNode; padded?: boolean; className?: string
}) {
  return (
    <section className={className}>
      {title && <h3 className={MODAL_SECTION_TITLE}>{tr(title)}</h3>}
      <div className={cn('rounded-2xl border border-gray-200 bg-gray-50', padded ? 'p-4' : 'divide-y divide-gray-200 px-4')}>{children}</div>
    </section>
  )
}

/** 1 dòng tóm tắt (cột "Hiện tại" / "Mặc định gốc"): nhãn caption trên, giá trị dưới */
export function ModalSummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="label-caption">{tr(label)}</dt>
      <dd className="truncate text-body font-medium text-charcoal">{trChildren(children)}</dd>
    </div>
  )
}
