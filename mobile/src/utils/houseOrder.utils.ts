import type { House } from '@/types'

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
