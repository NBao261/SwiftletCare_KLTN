import type { IFarm } from '@/models/Farm'

/** true nếu user là owner/member của farm, hoặc ADMIN */
export function hasFarmAccess(farm: Pick<IFarm, 'owner_id' | 'members'>, userId: string, role: string): boolean {
  if (role === 'ADMIN') return true
  if (String(farm.owner_id) === userId) return true
  return farm.members.some(m => String(m.user_id) === userId)
}

/** true nếu user là Primary Owner của farm, hoặc ADMIN */
export function isPrimaryOwner(farm: Pick<IFarm, 'owner_id'>, userId: string, role: string): boolean {
  return role === 'ADMIN' || String(farm.owner_id) === userId
}
