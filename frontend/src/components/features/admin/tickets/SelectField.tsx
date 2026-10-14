import type { ReactNode } from 'react'
import { tr } from '@/i18n'

/**
 * Nhãn + ô + lỗi — cùng khuôn Input/Select (label-caption, dấu * đỏ, lỗi đỏ dưới ô) cho SelectMenu dạng
 * field. Dùng chung cho các popup ticket của Admin (Tạo ticket, Gán lại KTV, Đổi ưu tiên) để dropdown
 * giống nhau: danh sách tự vẽ, chọn tô LIME MIST, thay cho <select> native do hệ điều hành vẽ.
 */
export default function SelectField({ label, required, error, errorInLabel, hint, children }: {
  label: string; required?: boolean; error?: string
  /** Lỗi nằm cùng hàng nhãn (bên phải) thay vì dưới ô — hiện lỗi không làm popup cao thêm (như Input `errorInLabel`) */
  errorInLabel?: boolean
  hint?: ReactNode; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-caption shrink-0">
          {tr(label)}
          {required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
        </span>
        {errorInLabel && error && <span className="min-w-0 truncate text-xs text-alertRed" title={tr(error)}>{tr(error)}</span>}
      </div>
      {children}
      {!errorInLabel && error && <span className="text-xs text-alertRed">{tr(error)}</span>}
      {hint}
    </div>
  )
}
