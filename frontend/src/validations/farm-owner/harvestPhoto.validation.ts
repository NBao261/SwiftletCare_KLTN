// HARVEST-FR-001 — ảnh của lần thu: cùng luật với PUT /harvests/{id}/photo (JPEG, PNG, WebP, tối đa 5 MB)
export const HARVEST_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const HARVEST_PHOTO_MAX_BYTES = 5 * 1024 * 1024

export type HarvestPhotoError = 'type' | 'size'

export function validateHarvestPhoto(file: { type: string; size: number }): HarvestPhotoError | null {
  if (!(HARVEST_PHOTO_TYPES as readonly string[]).includes(file.type)) return 'type'
  if (file.size > HARVEST_PHOTO_MAX_BYTES) return 'size'
  return null
}
