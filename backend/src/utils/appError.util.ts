export class AppError extends Error {
  statusCode: number
  code: string
  details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export const NotFoundError   = (message: string): AppError => new AppError(404, 'NOT_FOUND', message)
// code riêng cho lỗi mà màn hình cần nói đúng lý do (VD thiết lập thiết bị)
export const ForbiddenError  = (message: string, code = 'FORBIDDEN'): AppError => new AppError(403, code, message)
export const ConflictError   = (message: string, code = 'CONFLICT'): AppError => new AppError(409, code, message)
export const BadRequestError = (message: string, code = 'BAD_REQUEST'): AppError => new AppError(400, code, message)
export const UnauthorizedError = (message: string): AppError => new AppError(401, 'UNAUTHORIZED', message)
// Phía còn lại (VD firmware) chưa hỗ trợ
export const NotImplementedError = (message: string): AppError => new AppError(501, 'NOT_IMPLEMENTED', message)
// Client thử lại sau là hợp lý
export const ServiceUnavailableError = (message: string): AppError => new AppError(503, 'SERVICE_UNAVAILABLE', message)
