import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePermission } from '@/hooks/common/usePermission'
import type { Role } from '@/types'

interface RequireRoleProps {
  allow: Role[]
  children: ReactNode
}

// Chặn route theo role; ẩn/hiện nút thì dùng usePermission()
export default function RequireRole({ allow, children }: RequireRoleProps) {
  const allowed = usePermission(...allow)
  if (!allowed) return <Navigate to="/403" replace />
  return <>{children}</>
}
