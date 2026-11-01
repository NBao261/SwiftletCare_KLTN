import { Stack } from 'expo-router'
import { usePalette } from '@/hooks/theme/usePalette'

// Mở thẳng Màn B (từ Trang chủ hoặc lần sau vào tab) thì Màn A vẫn nằm dưới, nút ‹ luôn về danh sách nhà
export const unstable_settings = { anchor: 'index' }

/** Tab Trang trại: Màn A danh sách nhà yến của farm → Màn B một nhà (camera + cảm biến); thanh tab vẫn hiện */
export default function FarmsLayout() {
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
