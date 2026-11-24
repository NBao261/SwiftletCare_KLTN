import type { Farm, House } from '@/types'

// Nhà đã ghim lên đầu, giữ nguyên thứ tự còn lại — giống sortPinnedFirst của web
export function sortPinnedFirst<Item extends { _id: string }>(houses: readonly Item[], pinnedIds: readonly string[]): Item[] {
  const pinned = new Set(pinnedIds)
  return [...houses.filter(house => pinned.has(house._id)), ...houses.filter(house => !pinned.has(house._id))]
}

// Nhà mở thẳng khi vào tab Farm: farm chỉ có 1 nhà thì nhà đó; nhà xem gần nhất còn tồn tại thì nhà đó; còn lại null
export function resolveEntryHouseId(houses: House[], lastHouseId: string | undefined): string | null {
  if (houses.length === 1) return houses[0]._id
  if (lastHouseId && houses.some(house => house._id === lastHouseId)) return lastHouseId
  return null
}

// Một nhà trong bộ chọn nhà kèm farm của nó
export interface HouseChoice {
  house: House
  farmName: string
  isPinned: boolean
}

// Nhà của mọi farm theo đúng thứ tự tab Trang trại: farm theo thứ tự đã xếp (tạo trước đứng đầu), trong mỗi farm nhà ghim lên
// đầu rồi tới thứ tự backend trả; nhà của farm không còn trong danh sách thì bỏ
export function orderHousesByFarm(farms: readonly Farm[], houses: readonly House[], pinnedIds: readonly string[]): HouseChoice[] {
  const pinned = new Set(pinnedIds)
  const housesByFarmId = new Map<string, House[]>()
  for (const house of houses) housesByFarmId.set(house.farm_id, [...(housesByFarmId.get(house.farm_id) ?? []), house])
  return farms.flatMap(farm =>
    sortPinnedFirst(housesByFarmId.get(farm._id) ?? [], pinnedIds).map(house => ({
      house,
      farmName: farm.name,
      isPinned: pinned.has(house._id),
    })),
  )
}
