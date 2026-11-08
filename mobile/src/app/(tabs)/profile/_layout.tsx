import { Stack } from 'expo-router'
import { usePalette } from '@/hooks/theme/usePalette'

// Mở thẳng một màn con (từ thông báo) thì trang Tài khoản vẫn nằm dưới, nút ‹ luôn về trang Tài khoản
export const unstable_settings = { anchor: 'index' }

/** Tab Tài khoản: trang chính → các màn con (thành viên, thông báo, đổi mật khẩu, cài đặt ứng dụng…); thanh tab vẫn hiện */
export default function ProfileLayout() {
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
