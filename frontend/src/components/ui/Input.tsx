import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'
import FieldError from '@/components/ui/FieldError'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  // Icon trái trong ô input (VD kính lúp cho ô tìm kiếm): không truyền thì input giữ nguyên như cũ.
  icon?: ReactNode
  // Lỗi cùng hàng nhãn để popup không đổi chiều cao
  errorInLabel?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label: rawLabel, error: rawError, icon, errorInLabel, className, id, placeholder, ...props }, ref) => {
    // Không có id hay name thì nhãn vẫn phải gắn vào ô (FE_Design a11y): id tự sinh
    const generatedId = useId()
    const inputId = id ?? props.name ?? generatedId
    // Nhãn/lỗi/placeholder tự dịch theo VI/EN (chuỗi không có bản dịch giữ nguyên)
    const label = tr(rawLabel), error = tr(rawError)
    const errorId = `${inputId}-error`
    const describedBy = [props['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={inputId} className="label-caption shrink-0">
              {label}
              {props.required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
            </label>
            {errorInLabel && error && <span title={error} className="min-w-0"><FieldError id={errorId} inline>{error}</FieldError></span>}
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
            aria-invalid={error ? true : props['aria-invalid']}
            aria-describedby={describedBy}
          />
        </div>
        {!(errorInLabel && label) && error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    )
  },
)
Input.displayName = 'Input'
