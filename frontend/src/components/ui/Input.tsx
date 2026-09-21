import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Icon trái trong ô input (VD kính lúp cho ô tìm kiếm) — không truyền thì input giữ nguyên như cũ. */
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...props }, ref) => {
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
        {error && <span className="text-xs text-alertRed">{error}</span>}
      </div>
    )
  },
)
Input.displayName = 'Input'
