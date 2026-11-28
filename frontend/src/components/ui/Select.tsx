import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'
import FieldError from '@/components/ui/FieldError'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

// Select: cùng khuôn với Input.tsx, dùng lại class `.input` (index.css)
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => {
    const selectId = id ?? props.name
    const errorId = `${selectId ?? 'field'}-error`
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="label-caption">
            {label}
            {props.required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn('input', error && 'border-alertRed focus:border-alertRed', className)}
          {...props}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={error ? errorId : props['aria-describedby']}
        >
          {children}
        </select>
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    )
  },
)
Select.displayName = 'Select'
