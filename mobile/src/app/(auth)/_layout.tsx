import { Stack } from 'expo-router'
import { usePalette } from '@/hooks/theme/usePalette'

// Nhóm màn xác thực — không có đăng ký công khai (Report 3 §1.2)
export default function AuthLayout() {
  const palette = usePalette()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  )
}
