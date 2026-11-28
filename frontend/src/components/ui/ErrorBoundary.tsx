import { Component, type ErrorInfo, type ReactNode } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import EmptyState from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

interface ErrorBoundaryProps {
  children: ReactNode
  // Dựng lại khi giá trị này đổi (VD pathname): chuyển trang là tự hồi phục
  resetKey?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  resetKey?: string
}

// Lỗi khi render chỉ làm hỏng khu vực này, không trắng cả app. Không hiện error.message hay stack (FE_Design 13.16)
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { hasError: false, resetKey: props.resetKey }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Lỗi đã được React ghi ở console của trình duyệt; chưa có dịch vụ thu lỗi để gửi
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="p-6">
        <EmptyState
          icon={<WarningCircleIcon size={32} weight="fill" className="text-alertRed" aria-hidden />}
          title="Có lỗi khi hiển thị phần này"
          description="Phần còn lại của ứng dụng vẫn dùng được. Thử lại hoặc về trang chủ."
          action={(
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => this.setState({ hasError: false })}>Thử lại</Button>
              <Button size="sm" onClick={() => window.location.assign('/')}>Về trang chủ</Button>
            </div>
          )}
        />
      </div>
    )
  }
}
