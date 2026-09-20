import { AsyncLocalStorage } from 'async_hooks'

/**
 * Ngữ cảnh của request đang xử lý, để tầng dưới (VD `logAction`) đọc được IP
 * client mà không phải truyền `req` qua từng chữ ký hàm service.
 */
interface RequestContext {
  ip?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn)
}

/** IP client của request hiện tại; undefined khi chạy ngoài request (job nền, MQTT handler, test). */
export function getRequestIp(): string | undefined {
  return storage.getStore()?.ip
}
