import type { CameraNode, CountingRing } from '@/types'

// Mỗi lỗ ra vào một vòng; khớp giới hạn của backend
export const MAX_RINGS = 2

// Bản ghi trước khi có nhiều vòng chỉ có counting_ring
export function ringsOfCamera(camera: Pick<CameraNode, 'counting_rings' | 'counting_ring'>): CountingRing[] {
  if (camera.counting_rings) return camera.counting_rings
  return camera.counting_ring ? [camera.counting_ring] : []
}

// Lịch sử và mục duyệt cũ ghi 1 vòng (null = chưa vẽ), bản mới ghi danh sách vòng
export function ringList(value: unknown): CountingRing[] {
  if (Array.isArray(value)) return value as CountingRing[]
  return value && typeof value === 'object' && 'points' in value ? [value as CountingRing] : []
}
