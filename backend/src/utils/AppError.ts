/** Lỗi nghiệp vụ có mã HTTP rõ ràng — service throw, controller/errorHandler bắt và trả response */
export class AppError extends Error {
  statusCode: number
  code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
  }
}

export const NotFoundError   = (message: string): AppError => new AppError(404, 'NOT_FOUND', message)
export const ForbiddenError  = (message: string): AppError => new AppError(403, 'FORBIDDEN', message)
export const ConflictError   = (message: string): AppError => new AppError(409, 'CONFLICT', message)
export const BadRequestError = (message: string): AppError => new AppError(400, 'BAD_REQUEST', message)
export const UnauthorizedError = (message: string): AppError => new AppError(401, 'UNAUTHORIZED', message)
