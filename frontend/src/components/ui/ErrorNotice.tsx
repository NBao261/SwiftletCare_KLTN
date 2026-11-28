import type { ReactNode } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

interface ErrorNoticeProps {
  // Câu nói thao tác nào thất bại và làm gì tiếp (dùng useApiErrorMessage)
  children: ReactNode
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

// Lỗi khi gửi form hoặc làm một thao tác: một kiểu duy nhất cho mọi màn, đặt ngay trên nút gửi.
// role="alert" để trình đọc màn hình đọc ngay khi lỗi xuất hiện
export default function ErrorNotice({ children, onRetry, retrying = false, className }: ErrorNoticeProps) {
  return (
    <div
      role="alert"
      className={cn('flex items-start gap-2.5 rounded-xl border border-alertRed/20 bg-alertRed/10 px-3.5 py-3 text-sm font-medium text-alertRed', className)}
    >
      <WarningCircleIcon size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" loading={retrying} onClick={onRetry} className="shrink-0">
          Thử lại
        </Button>
      )}
    </div>
  )
}
