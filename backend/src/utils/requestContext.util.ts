import { AsyncLocalStorage } from 'async_hooks'
import type { Role } from '@/types'

/**
 * Ngữ cảnh của request đang xử lý, để tầng dưới (VD `logAction`) đọc được IP
 * client và vai trò người gọi mà không phải truyền `req` qua từng chữ ký hàm service.
 */
interface RequestContext {
  ip?: string
  /** Vai trò người đã đăng nhập — `authenticate` ghi vào sau khi xác thực token */
  actorRole?: Role
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn)
}

/** IP client của request hiện tại; undefined khi chạy ngoài request (job nền, MQTT handler, test). */
export function getRequestIp(): string | undefined {
  return storage.getStore()?.ip
}

/** Ghi vai trò người gọi vào ngữ cảnh request hiện tại; ngoài request thì bỏ qua */
export function setRequestActorRole(role: Role): void {
  const store = storage.getStore()
  if (store) store.actorRole = role
}

/** Vai trò người gọi của request hiện tại; undefined ngoài request hoặc trước khi xác thực */
export function getRequestActorRole(): Role | undefined {
  return storage.getStore()?.actorRole
}
