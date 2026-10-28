import { useColorScheme } from 'react-native'
import { Colors } from '@/constants/theme'

// Bộ màu sáng/tối theo cài đặt giao diện của máy
export function usePalette() {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light']
}
