import type { WorkOrder } from '@/types'

// Bảo trì phải có ít nhất 1 ảnh bằng chứng: ảnh của phiếu, ảnh một mục checklist hoặc ảnh chọn lần này (OPS-FR-008)
export const MIN_PREVENTIVE_PHOTOS = 1

export function missingMaintenancePhoto(
  workOrder: Pick<WorkOrder, 'kind' | 'photo_urls' | 'checklist'> | null | undefined, newPhotos: number,
): boolean {
  if (!workOrder || workOrder.kind !== 'PREVENTIVE') return false
  const saved = (workOrder.photo_urls?.length ?? 0) + (workOrder.checklist ?? []).filter(item => item.photo_url).length
  return saved + newPhotos < MIN_PREVENTIVE_PHOTOS
}
