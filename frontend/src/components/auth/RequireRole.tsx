import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePermission } from '@/hooks/common/usePermission'
import type { Role } from '@/types'

interface RequireRoleProps {
  allow: Role[]
  children: ReactNode
}

/**
 * Guard cấp route — dùng lồng bên trong ProtectedRoute cho những route mà
 * backend chặn toàn bộ theo role (vd router harvests chỉ cho FARM_OWNER/ADMIN).
 * Không dùng cho việc ẩn/hiện nút bấm — dùng usePermission() cho việc đó.
 */
export default function RequireRole({ allow, children }: RequireRoleProps) {
  const allowed = usePermission(...allow)
  if (!allowed) return <Navigate to="/403" replace />
  return <>{children}</>
}
