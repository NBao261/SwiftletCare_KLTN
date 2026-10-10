import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Icon trái trong ô input (VD kính lúp cho ô tìm kiếm) — không truyền thì input giữ nguyên như cũ. */
  icon?: ReactNode
  /**
   * Luôn chừa sẵn 1 dòng cho thông báo lỗi kể cả khi chưa có lỗi — dùng trong popup canh giữa: lỗi hiện/ẩn
   * làm popup đổi chiều cao thì cả popup trượt lên/xuống.
   */
  reserveError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, reserveError, className, id, ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label-caption">
            {label}
            {props.required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
          </label>
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
            {...props}
          />
        </div>
        {/* reserveError: đúng 1 dòng cố định (h-4 + truncate) — lỗi dài cũng không đẩy popup cao lên */}
        {reserveError
          ? <span className="h-4 truncate text-xs text-alertRed" title={error}>{error}</span>
          : error && <span className="text-xs text-alertRed">{error}</span>}
      </div>
    )
  },
)
Input.displayName = 'Input'
