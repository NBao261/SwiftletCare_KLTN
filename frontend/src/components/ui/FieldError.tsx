import type { ReactNode } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

interface FieldErrorProps {
  // Ô nhập trỏ tới bằng aria-describedby
  id?: string
  children: ReactNode
  // Một dòng, cắt bớt: dùng cạnh nhãn để popup không đổi chiều cao (xem Input#errorInLabel)
  inline?: boolean
  className?: string
}

// Lỗi của một ô nhập: biểu tượng + chữ (không chỉ dựa vào màu đỏ), đọc được bằng trình đọc màn hình
export default function FieldError({ id, children, inline = false, className }: FieldErrorProps) {
  return (
    <p
      id={id}
      className={cn('flex min-w-0 items-start gap-1 text-small font-medium text-alertRed', inline && 'items-center', className)}
    >
      <WarningCircleIcon size={14} weight="fill" aria-hidden className={cn('shrink-0', !inline && 'mt-[3px]')} />
      <span className={cn(inline && 'truncate')}>{children}</span>
    </p>
  )
}
