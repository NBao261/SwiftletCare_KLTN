import type { BirdCountDay, House } from '@/types'

// Tỷ lệ về tổ hôm nay ở Trang chủ: mỗi nhà một số (return_rate của backend, không gộp nhiều nhà), người dùng chọn nhà và chọn
// thấy nhà thấp nhất hay cao nhất trước

export type ReturnRateOrder = 'lowest-first' | 'highest-first'

export const DEFAULT_RETURN_RATE_ORDER: ReturnRateOrder = 'lowest-first'

export interface HouseReturnRate {
  house: Pick<House, '_id' | 'name' | 'farm_id'>
  // Số đếm hôm nay; null khi chưa tải được số của nhà này
  day: BirdCountDay | null
}

// Tỷ lệ của một dòng; chưa đủ phiên sáng và chiều thì null
export function getReturnRate(row: HouseReturnRate): number | null {
  return row.day?.return_rate ?? null
}

// Sắp các nhà theo tỷ lệ: thấp nhất hoặc cao nhất trước, nhà chưa có tỷ lệ luôn đứng cuối, bằng nhau thì theo tên. Trả mảng mới
export function sortHousesByReturnRate(rows: readonly HouseReturnRate[], order: ReturnRateOrder): HouseReturnRate[] {
  const direction = order === 'lowest-first' ? 1 : -1
  return [...rows].sort((left, right) => {
    const leftRate = getReturnRate(left)
    const rightRate = getReturnRate(right)
    if (leftRate === null || rightRate === null) {
      if (leftRate !== rightRate) return leftRate === null ? 1 : -1
    } else if (leftRate !== rightRate) {
      return (leftRate - rightRate) * direction
    }
    return left.house.name.localeCompare(right.house.name, 'vi')
  })
}

// Nhà đang hiện: nhà người dùng đã chọn nếu còn trong danh sách, không thì nhà đứng đầu; danh sách trống thì null
export function pickReturnRateHouse(sorted: readonly HouseReturnRate[], selectedHouseId: string | null): HouseReturnRate | null {
  return sorted.find(row => row.house._id === selectedHouseId) ?? sorted[0] ?? null
}
