import type { ReactNode } from 'react'

/**
 * Nhãn + ô + lỗi — cùng khuôn Input/Select (label-caption, dấu * đỏ, lỗi đỏ dưới ô) cho SelectMenu dạng
 * field. Dùng chung cho các popup ticket của Admin (Tạo ticket, Gán lại KTV, Đổi ưu tiên) để dropdown
 * giống nhau: danh sách tự vẽ, chọn tô LIME MIST, thay cho <select> native do hệ điều hành vẽ.
 */
export default function SelectField({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: ReactNode; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-caption">
        {label}
        {required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
      </span>
      {children}
      {error && <span className="text-xs text-alertRed">{error}</span>}
      {hint}
    </div>
  )
}
