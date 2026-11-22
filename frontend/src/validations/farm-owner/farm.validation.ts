import type { FarmKey } from '@/constants/farmStructure.i18n'

export type FarmLocationError = Extract<FarmKey, 'farmForm.errorLocationRequired' | 'farmForm.errorLatitude' | 'farmForm.errorLongitude'>

// Ô có số trong khoảng [-limit, limit]
function isInRange(value: string, limit: number): boolean {
  const number = Number(value.trim())
  return value.trim() !== '' && Number.isFinite(number) && Math.abs(number) <= limit
}

// Sửa farm để trống cả 2 ô thì giữ vị trí cũ
export function validateFarmLocation(latitude: string, longitude: string, isRequired: boolean): FarmLocationError | null {
  if (!latitude.trim() && !longitude.trim()) return isRequired ? 'farmForm.errorLocationRequired' : null
  if (!isInRange(latitude, 90)) return 'farmForm.errorLatitude'
  if (!isInRange(longitude, 180)) return 'farmForm.errorLongitude'
  return null
}

// Hai ô đang hợp lệ thì trả toạ độ để đặt ghim trên bản đồ, chưa hợp lệ thì null
export function parseFarmLocation(latitude: string, longitude: string): { lat: number; lng: number } | null {
  if (!isInRange(latitude, 90) || !isInRange(longitude, 180)) return null
  return { lat: Number(latitude.trim()), lng: Number(longitude.trim()) }
}
