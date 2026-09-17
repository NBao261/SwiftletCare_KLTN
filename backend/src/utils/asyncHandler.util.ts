import { Request, Response, NextFunction } from 'express'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

/**
 * Bọc controller async — thay cho việc mỗi handler tự viết
 * `try { ... } catch (err) { next(err) }`. Express 4 không tự bắt lỗi từ
 * async handler: quên viết try/catch thì promise reject rơi mất, request
 * treo tới khi client timeout, không có lỗi nào được log. Wrapper này đảm
 * bảo `next(err)` luôn được gọi mà không cần lặp lại try/catch mỗi hàm.
 */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next)
  }
}
