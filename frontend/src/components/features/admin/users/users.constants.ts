import type { BadgeTone } from '@/components/ui'
import type { UserStatus } from '@/types'
import { translated } from '@/i18n'

export const STATUS_LABEL: Record<UserStatus, string> = translated({
  ACTIVE: 'Hoạt động', LOCKED: 'Đã khoá', PENDING_DELETION: 'Chờ xoá', DELETED: 'Đã xoá',
})
export const STATUS_TONE: Record<UserStatus, BadgeTone> = {
  ACTIVE: 'positive', LOCKED: 'critical', PENDING_DELETION: 'warning', DELETED: 'neutral',
}
// Chỉ 2 giá trị map vào ?status=; chờ xoá có trang riêng, đã xoá nằm trong inactive
export type FilterableStatus = Extract<UserStatus, 'ACTIVE' | 'LOCKED'>
export const FILTERABLE_STATUSES: FilterableStatus[] = ['ACTIVE', 'LOCKED']

// Re-export để thư mục này import 1 chỗ
export { ROLE_LABEL } from '@/constants/roles'
