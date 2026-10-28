// Vỏ phản hồi chung của backend; danh sách có thêm meta phân trang
export interface ApiResponse<Data = unknown> {
  data: Data
  meta?: { page?: number; limit?: number; total?: number }
}

// Phản hồi lỗi của backend (ApiError trong docs/api/api-spec.yaml)
export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    // Tuỳ mã lỗi, ví dụ { retryAfterSec } của RATE_LIMITED, { reason } của ACCOUNT_DISABLED
    details?: Record<string, unknown>
  }
}
