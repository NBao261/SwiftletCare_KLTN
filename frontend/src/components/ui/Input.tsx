import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Icon trái trong ô input (VD kính lúp cho ô tìm kiếm) — không truyền thì input giữ nguyên như cũ. */
  icon?: ReactNode
  /**
   * Hiện lỗi cùng hàng với nhãn (nhãn trái, lỗi phải, 1 dòng cắt "…") thay vì dòng riêng dưới ô — dùng trong popup
   * canh giữa: lỗi hiện/ẩn không làm popup đổi chiều cao (không trượt lên/xuống) mà cũng không phải chừa dòng trống.
   */
  errorInLabel?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label: rawLabel, error: rawError, icon, errorInLabel, className, id, placeholder, ...props }, ref) => {
    const inputId = id ?? props.name
    // Nhãn/lỗi/placeholder tự dịch theo VI/EN (chuỗi không có bản dịch giữ nguyên)
    const label = tr(rawLabel), error = tr(rawError)
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={inputId} className="label-caption shrink-0">
              {label}
              {props.required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
            </label>
            {errorInLabel && error && <span className="min-w-0 truncate text-xs text-alertRed" title={error}>{error}</span>}
          </div>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-warmGray">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn('input', icon && 'pl-10', error && 'border-alertRed focus:border-alertRed', className)}
            placeholder={tr(placeholder)}
            {...props}
          />
        </div>
        {!(errorInLabel && label) && error && <span className="text-xs text-alertRed">{error}</span>}
      </div>
    )
  },
)
Input.displayName = 'Input'
