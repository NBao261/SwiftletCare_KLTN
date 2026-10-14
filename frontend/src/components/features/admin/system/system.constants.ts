import { CloudIcon, DropIcon, FlaskIcon, SunIcon, ThermometerSimpleIcon, type Icon } from '@phosphor-icons/react'
import type { SystemDefaultThresholds } from '@/types'

export type ThresholdKey = keyof SystemDefaultThresholds

/**
 * Gộp cặp min/max cùng 1 thông số vào 1 ô (temp, humidity) thay vì 2 ô rời —
 * "NHIỆT ĐỘ MIN"/"NHIỆT ĐỘ MAX" đứng cạnh nhau, cùng size/màu, khó phân biệt khi
 * quét nhanh. light/nh3/co2 chỉ có 1 giá trị (max) nên vẫn hiện dạng đơn.
 * Icon phosphor (cùng bộ với StatTile) — mỗi thông số 1 hình riêng, không trùng nhau.
 */
export type ThresholdGroup =
  | { kind: 'range'; label: string; icon: Icon; minKey: ThresholdKey; maxKey: ThresholdKey }
  | { kind: 'single'; label: string; icon: Icon; key: ThresholdKey }

export const THRESHOLD_GROUPS: ThresholdGroup[] = [
  { kind: 'range', label: 'Nhiệt độ', icon: ThermometerSimpleIcon, minKey: 'temp_min', maxKey: 'temp_max' },
  { kind: 'range', label: 'Độ ẩm', icon: DropIcon, minKey: 'humidity_min', maxKey: 'humidity_max' },
  { kind: 'single', label: 'Ánh sáng', icon: SunIcon, key: 'light_max' },
  { kind: 'single', label: 'NH3', icon: FlaskIcon, key: 'nh3_max' },
  { kind: 'single', label: 'CO2', icon: CloudIcon, key: 'co2_max' },
]
