import { Stack } from 'expo-router'
import { usePalette } from '@/hooks/theme/usePalette'
import { useLanguage } from '@/hooks/i18n/useLanguage'

// Nhóm màn xác thực — không có đăng ký công khai (Report 3 §1.2)
export default function AuthLayout() {
  const palette = usePalette()
  // Ngôn ngữ dùng gần nhất trên máy nạp xong thì dựng lại các màn xác thực cho đúng ngôn ngữ
  const language = useLanguage()

  return (
    <Stack
      key={language}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  )
}
