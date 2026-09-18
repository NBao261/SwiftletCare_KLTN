import { useState } from 'react'
import { cn } from '@/utils/cn'

interface StarRatingProps {
  value?: number
  onChange?: (value: number) => void
  readOnly?: boolean
}

/** Đánh giá 1–5 sao (TICKET-FR-011) — bấm để chọn, dùng lại đọc-only để hiển thị điểm đã có */
export default function StarRating({ value = 0, onChange, readOnly }: StarRatingProps) {
  const [hover, setHover] = useState(0)
  const display = hover || value

  return (
    <div className="flex items-center gap-1" role={readOnly ? undefined : 'radiogroup'} aria-label="Đánh giá">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          aria-label={`${star} sao`}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={cn('transition-colors', readOnly ? 'cursor-default' : 'cursor-pointer')}
        >
          <svg
            width="24" height="24" viewBox="0 0 20 20"
            className={star <= display ? 'fill-climateOrange stroke-climateOrange' : 'fill-none stroke-warmGray'}
            strokeWidth="1.4" strokeLinejoin="round"
          >
            <path d="M10 2.5l2.3 4.7 5.2.7-3.8 3.6.9 5.1L10 14.1l-4.6 2.5.9-5.1-3.8-3.6 5.2-.7Z" />
          </svg>
        </button>
      ))}
    </div>
  )
}
