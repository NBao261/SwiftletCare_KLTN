import { IconTemp, IconHumidity, IconLight, IconAlert, IconCloud } from '@/components/ui/icons'
import type { SystemDefaultThresholds } from '@/types'

export type ThresholdKey = keyof SystemDefaultThresholds

/**
 * Gộp cặp min/max cùng 1 thông số vào 1 hàng (temp, humidity) thay vì 2 ô rời —
 * "NHIỆT ĐỘ MIN"/"NHIỆT ĐỘ MAX" đứng cạnh nhau, cùng size/màu, khó phân biệt khi
 * quét nhanh. light/nh3/co2 chỉ có 1 giá trị (max) nên vẫn hiện dạng đơn.
 */
export type ThresholdGroup =
  | { kind: 'range'; label: string; icon: typeof IconTemp; minKey: ThresholdKey; maxKey: ThresholdKey }
  | { kind: 'single'; label: string; icon: typeof IconTemp; key: ThresholdKey }

export const THRESHOLD_GROUPS: ThresholdGroup[] = [
  { kind: 'range', label: 'Nhiệt độ', icon: IconTemp, minKey: 'temp_min', maxKey: 'temp_max' },
  { kind: 'range', label: 'Độ ẩm', icon: IconHumidity, minKey: 'humidity_min', maxKey: 'humidity_max' },
  { kind: 'single', label: 'Ánh sáng tối đa', icon: IconLight, key: 'light_max' },
  // NH3/CO2 trước đây cùng dùng IconGas (2 icon lửa giống hệt nhau, dễ đọc nhầm) — tách riêng: IconAlert (tam giác cảnh báo) và IconCloud (mây)
  { kind: 'single', label: 'NH3 tối đa', icon: IconAlert, key: 'nh3_max' },
  { kind: 'single', label: 'CO2 tối đa', icon: IconCloud, key: 'co2_max' },
]
