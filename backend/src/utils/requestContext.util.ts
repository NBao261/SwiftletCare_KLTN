import { AsyncLocalStorage } from 'async_hooks'
import type { Role } from '@/types'

/**
 * Ngữ cảnh của request đang xử lý, để tầng dưới (VD `logAction`) đọc được IP
 * client và vai trò người gọi mà không phải truyền `req` qua từng chữ ký hàm service.
 */
interface RequestContext {
  ip?: string
  /** Report 4 §6.1 AUDIT_LOG.client — User-Agent của web/mobile */
  client?: string
  /** Report 4 §6.1 AUDIT_LOG.correlation_id — một mã cho mọi dòng audit của cùng request */
  correlationId?: string
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

/** User-Agent và mã của request hiện tại cho audit log; rỗng ngoài request */
export function getRequestClient(): { client?: string; correlationId?: string } {
  const store = storage.getStore()
  return { client: store?.client, correlationId: store?.correlationId }
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
