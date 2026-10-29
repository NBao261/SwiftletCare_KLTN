import { Colors } from '@/constants/theme'

// Bộ màu của app — chỉ có giao diện sáng, không đổi theo cài đặt sáng/tối của máy
export function usePalette() {
  return Colors.light
}
