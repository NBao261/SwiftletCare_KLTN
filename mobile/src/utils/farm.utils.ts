import type { Farm, FarmMember, House } from '@/types'

// Farm có Domain Expert không — không có thì Farm Owner quyết thay (BR-22)
export function farmHasExpert(farm: Farm): boolean {
  return farm.members.some(member => member.role === 'DOMAIN_EXPERT')
}

// Một kỹ thuật viên được giao nhà kèm tên đọc từ thành viên farm (AUTH-FR-013)
export interface HouseTechnicianName {
  userId: string
  name: string
  isPrimary: boolean
}

// Kỹ thuật viên của nhà, người chính đứng đầu; người đã rời farm (không còn trong thành viên) thì bỏ
export function getHouseTechnicianNames(house: House, members: FarmMember[]): HouseTechnicianName[] {
  const nameById = new Map(members.map(member => [member.user_id, member.full_name || member.email || '']))
  return (house.technicians ?? [])
    .filter(technician => Boolean(nameById.get(technician.user_id)))
    .map(technician => ({
      userId: technician.user_id,
      name: nameById.get(technician.user_id) ?? '',
      isPrimary: technician.primary,
    }))
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
}
