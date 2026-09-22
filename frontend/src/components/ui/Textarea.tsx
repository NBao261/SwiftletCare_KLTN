import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

/** Textarea — cùng khuôn với Input.tsx, dùng lại class `.input` (index.css) */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, rows = 3, ...props }, ref) => {
    const textareaId = id ?? props.name
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="label-caption">
            {label}
            {props.required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn('input resize-none', error && 'border-alertRed focus:border-alertRed', className)}
          {...props}
        />
        {error && <span className="text-xs text-alertRed">{error}</span>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
