import { cn } from '@/lib/cn'

const SIZE_CLASS = {
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-2xl',
} as const

// Avatar chữ cái đầu của tên, một kiểu màu cho mọi chỗ
export default function Avatar({ name, size = 'md', className }: {
  name?: string
  size?: keyof typeof SIZE_CLASS
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-charcoal font-bold text-limeMist', SIZE_CLASS[size], className)}
    >
      {name?.trim()[0]?.toUpperCase() ?? 'U'}
    </span>
  )
}
