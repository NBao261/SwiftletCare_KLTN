import type { BirdCountDay } from '@/types'

export interface HouseBirdCount {
  houseName: string
  day: BirdCountDay
}

export interface ReturnRateSummary {
  // Tỷ lệ chung của các nhà đủ dữ liệu; null khi chưa nhà nào đủ
  rate: number | null
  housesWithData: number
  // Nhà có tỷ lệ thấp nhất — chỉ có khi từ 2 nhà đủ dữ liệu trở lên
  lowest: { houseName: string; rate: number } | null
}

// Gộp tỷ lệ về tổ hôm nay của nhiều nhà: tổng chim về ròng / tổng chim ra ròng, cùng công thức return_rate của backend
export function summarizeReturnRate(houseCounts: HouseBirdCount[]): ReturnRateSummary {
  let netEntryTotal = 0
  let netExitTotal = 0
  let housesWithData = 0
  let lowest: ReturnRateSummary['lowest'] = null

  for (const { houseName, day } of houseCounts) {
    if (day.return_rate === null) continue
    netEntryTotal += day.net_entry
    netExitTotal += day.net_exit
    housesWithData += 1
    if (!lowest || day.return_rate < lowest.rate) lowest = { houseName, rate: day.return_rate }
  }

  return {
    rate: netExitTotal > 0 ? (netEntryTotal / netExitTotal) * 100 : null,
    housesWithData,
    lowest: housesWithData >= 2 ? lowest : null,
  }
}
