import type { CameraNode, CountingRing } from '@/types'

// Khớp giới hạn của backend
export const MAX_RINGS = 4
export const MIN_POINTS = 3
export const MAX_POINTS = 12
// Đủ ngần này đỉnh thì chạm tiếp là sang vòng mới; chọn lại vòng thì thêm được tới MAX_POINTS
export const POINTS_BEFORE_NEXT_RING = 4

// Bản ghi trước khi có nhiều vòng chỉ có counting_ring
export function ringsOfCamera(camera: Pick<CameraNode, 'counting_rings' | 'counting_ring'>): CountingRing[] {
  if (camera.counting_rings) return camera.counting_rings
  return camera.counting_ring ? [camera.counting_ring] : []
}

// Chưa vẽ vòng nào thì hiện vòng mặc định nút AI báo lên, như một vòng thường
export function shownRings(camera: Pick<CameraNode, 'counting_rings' | 'counting_ring' | 'default_rings'>) {
  const saved = ringsOfCamera(camera)
  if (saved.length > 0) return { rings: saved, isDefault: false }
  return { rings: camera.default_rings ?? [], isDefault: true }
}

// Lịch sử và mục duyệt cũ ghi 1 vòng (null = chưa vẽ), bản mới ghi danh sách vòng
export function ringList(value: unknown): CountingRing[] {
  if (Array.isArray(value)) return value as CountingRing[]
  return value && typeof value === 'object' && 'points' in value ? [value as CountingRing] : []
}

// Bỏ một vòng rồi chọn vòng cuối còn lại, để chạm tiếp mở vòng mới thay vì kéo dài vòng đầu
export function removeRing(rings: CountingRing[], index: number): { rings: CountingRing[]; activeIndex: number } {
  const next = rings.filter((_, position) => position !== index)
  return { rings: next, activeIndex: Math.max(next.length - 1, 0) }
}

// Một chạm lên khung: thêm đỉnh vào vòng đang chọn, hoặc mở vòng mới khi vòng đó đã đủ đỉnh
export function placePoint(
  rings: CountingRing[], activeIndex: number, point: [number, number], extending: boolean, intoRingIsExit: boolean,
): { rings: CountingRing[]; activeIndex: number } {
  const active = rings[activeIndex]
  const limit = extending ? MAX_POINTS : POINTS_BEFORE_NEXT_RING
  if (active && active.points.length < limit) {
    return {
      rings: rings.map((ring, index) => (index === activeIndex ? { ...ring, points: [...ring.points, point] } : ring)),
      activeIndex,
    }
  }
  if (rings.length >= MAX_RINGS) return { rings, activeIndex }
  return { rings: [...rings, { points: [point], into_ring_is_exit: intoRingIsExit }], activeIndex: rings.length }
}
