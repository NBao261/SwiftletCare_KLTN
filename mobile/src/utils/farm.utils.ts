import type { Farm } from '@/types'

// Farm có Domain Expert không — không có thì Farm Owner quyết thay (BR-22)
export function farmHasExpert(farm: Farm): boolean {
  return farm.members.some(member => member.role === 'DOMAIN_EXPERT')
}
