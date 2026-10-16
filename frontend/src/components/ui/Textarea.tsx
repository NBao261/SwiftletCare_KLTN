import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  /** Xem Input#errorInLabel — lỗi cùng hàng với nhãn để popup canh giữa không đổi chiều cao khi lỗi hiện/ẩn */
  errorInLabel?: boolean
}

/** Textarea — cùng khuôn với Input.tsx, dùng lại class `.input` (index.css) */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label: rawLabel, error: rawError, errorInLabel, className, id, rows = 3, placeholder, ...props }, ref) => {
    const textareaId = id ?? props.name
    // Nhãn/lỗi/placeholder tự dịch theo VI/EN (chuỗi không có bản dịch giữ nguyên)
    const label = tr(rawLabel), error = tr(rawError)
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={textareaId} className="label-caption shrink-0">
              {label}
              {props.required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
            </label>
            {errorInLabel && error && <span className="min-w-0 truncate text-xs text-alertRed" title={error}>{error}</span>}
          </div>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn('input resize-none', error && 'border-alertRed focus:border-alertRed', className)}
          placeholder={tr(placeholder)}
          {...props}
        />
        {!(errorInLabel && label) && error && <span className="text-xs text-alertRed">{error}</span>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
