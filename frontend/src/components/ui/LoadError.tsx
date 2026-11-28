import { WarningCircleIcon } from '@phosphor-icons/react'
import EmptyState from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'

interface LoadErrorProps {
  // Tên thứ không tải được: "Không tải được danh sách camera"
  title: string
  // Lỗi của câu truy vấn: câu nguyên nhân lấy theo nhóm lỗi (mạng, máy chủ, quyền…)
  error?: unknown
  onRetry?: () => void
}

// Thay cho EmptyState + nút Thử lại tự dựng ở mỗi màn khi tải dữ liệu thất bại: nói điều gì xảy ra rồi làm gì tiếp
export default function LoadError({ title, error, onRetry }: LoadErrorProps) {
  const apiErrorMessage = useApiErrorMessage()
  return (
    <EmptyState
      icon={<WarningCircleIcon size={32} weight="fill" className="text-alertRed" aria-hidden />}
      title={title}
      description={apiErrorMessage(error)}
      action={onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Thử lại</Button>}
    />
  )
}
