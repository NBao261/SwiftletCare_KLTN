import type { IFarm } from '@/models/farm.model'
import type { CurrentUser } from '@/types'

type FarmScope = Pick<IFarm, 'owner_id' | 'members' | 'region'>

/**
 * Technician (nhân viên công ty) được thao tác trên Farm nằm trong khu vực mình
 * phụ trách — không phải mọi Farm (SRS AUTH-FR-005c, RACI mục 4.4 ghi chú ¹).
 * Farm chưa gán `region` thì không Technician nào vào được, tránh mở quyền ngầm.
 */
function isAssignedTechnician(farm: Pick<IFarm, 'region'>, user: CurrentUser): boolean {
  if (user.role !== 'TECHNICIAN') return false
  if (!farm.region) return false
  return (user.assigned_regions ?? []).includes(farm.region)
}

/** true nếu user là owner/member của farm, ADMIN, hoặc Technician phụ trách khu vực */
export function hasFarmAccess(farm: FarmScope, user: CurrentUser): boolean {
  if (user.role === 'ADMIN') return true
  if (isAssignedTechnician(farm, user)) return true
  if (String(farm.owner_id) === user._id) return true
  return farm.members.some(m => String(m.user_id) === user._id)
}

/**
 * true nếu user là Primary Owner của farm, hoặc ADMIN.
 * Technician KHÔNG nằm trong nhóm này: các thao tác quản trị Farm (xóa farm,
 * mời/gỡ thành viên) thuộc về phía khách hàng, không phải nhân viên lắp đặt.
 */
export function isPrimaryOwner(farm: Pick<IFarm, 'owner_id'>, user: CurrentUser): boolean {
  return user.role === 'ADMIN' || String(farm.owner_id) === user._id
}
