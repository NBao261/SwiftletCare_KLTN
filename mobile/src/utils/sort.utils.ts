// Farm, zone tạo trước đứng đầu — giống web (FarmOwnerFarmsPage, deviceInventory): mã ObjectId của Mongo tăng theo
// thời gian tạo nên so chuỗi _id là đủ; backend trả mới nhất trước. Không đổi mảng gốc
export function sortByCreationOrder<Item extends { _id: string }>(items: readonly Item[]): Item[] {
  return [...items].sort((first, second) => first._id.localeCompare(second._id))
}
