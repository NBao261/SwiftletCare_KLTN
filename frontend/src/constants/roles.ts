import type { Role } from '@/types'

/** Nhãn vai trò dùng chung — Sidebar (hiển thị role user hiện tại), Settings, v.v. */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ nhà yến',
  TECHNICIAN: 'Kỹ thuật viên',
  SALES_STAFF: 'Nhân viên kinh doanh',
}

/**
 * Nhãn vai trò trong ngữ cảnh lời mời (InvitationPage) — chỉ 2 role mời được
 * (FARM_FR-*: FARM_OWNER mời thành viên/sales-staff). FARM_OWNER ở đây được
 * chú thích "(thành viên)" vì người được mời KHÔNG trở thành chủ sở hữu chính
 * (isPrimaryOwner), khác với nhãn chung ở trên — cố ý không dùng lại ROLE_LABEL
 * để tránh nhầm lẫn về quyền sở hữu farm.
 */
export const INVITE_ROLE_LABEL: Record<Extract<Role, 'FARM_OWNER' | 'SALES_STAFF'>, string> = {
  FARM_OWNER: `${ROLE_LABEL.FARM_OWNER} (thành viên)`,
  SALES_STAFF: ROLE_LABEL.SALES_STAFF,
}
