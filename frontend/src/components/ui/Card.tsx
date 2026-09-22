import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Card — mục 2.1 (rounded-2xl trung bình / rounded-3xl lớn) + 2.2.8 (card active Lime Mist) */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'active' | 'dark'
  size?: 'md' | 'lg'
}

const VARIANT_CLASS: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-white border border-warmGray/15 text-charcoal shadow-card',
  active:  'bg-limeMist text-charcoal',
  dark:    'bg-graphite text-white',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', size = 'md', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        size === 'lg' ? 'rounded-3xl p-6' : 'rounded-2xl p-5',
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'
