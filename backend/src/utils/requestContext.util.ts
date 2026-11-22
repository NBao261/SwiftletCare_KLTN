import { AsyncLocalStorage } from 'async_hooks'
import type { Role } from '@/types'

// Để logAction đọc IP, vai trò mà không phải truyền req qua service
interface RequestContext {
  ip?: string
  client?: string
  // Một mã cho mọi dòng audit của cùng request
  correlationId?: string
  // authenticate ghi vào
  actorRole?: Role
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn)
}

export function getRequestIp(): string | undefined {
  return storage.getStore()?.ip
}

export function getRequestClient(): { client?: string; correlationId?: string } {
  const store = storage.getStore()
  return { client: store?.client, correlationId: store?.correlationId }
}

export function setRequestActorRole(role: Role): void {
  const store = storage.getStore()
  if (store) store.actorRole = role
}

export function getRequestActorRole(): Role | undefined {
  return storage.getStore()?.actorRole
}
