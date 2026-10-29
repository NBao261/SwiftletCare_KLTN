import { Alert, type StyleProp, type ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/hooks/auth/useLogout'

interface LogoutButtonProps {
  variant?: 'secondary' | 'link'
  style?: StyleProp<ViewStyle>
}

// Nút đăng xuất dùng chung (tab Tài khoản, màn đổi mật khẩu tạm): hỏi lại trước khi thu hồi phiên (AUTH-FR-006)
export function LogoutButton({ variant = 'secondary', style }: LogoutButtonProps) {
  const logout = useLogout()

  const confirmLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi thiết bị này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => logout.mutate(undefined, { onSettled: () => router.replace('/(auth)/login') }),
      },
    ])
  }

  return <Button variant={variant} label="Đăng xuất" onPress={confirmLogout} loading={logout.isPending} style={style} />
}
