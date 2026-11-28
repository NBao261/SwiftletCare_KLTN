import type { House } from '@/types'

// Nhà trong phạm vi đang chọn: đã chọn nhà thì nhà đó, đã chọn trang trại thì các nhà của nó, chưa chọn thì tất cả nhà được giao
export function housesInScope<T extends Pick<House, '_id' | 'farm_id'>>(houses: T[], farmId: string, houseId: string): T[] {
  if (houseId) return houses.filter(house => house._id === houseId)
  if (farmId) return houses.filter(house => house.farm_id === farmId)
  return houses
}
