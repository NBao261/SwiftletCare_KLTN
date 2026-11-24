import { Redirect } from 'expo-router'
import { getRoleHomeHref } from '@/constants/roleTabs'
import { useAuthStore } from '@/stores/authStore'

// Sau splash: chưa đăng nhập → màn đăng nhập; còn mật khẩu tạm → đổi mật khẩu; còn lại → tab đầu của role
export default function Index() {
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  if (!isAuthenticated || !user) return <Redirect href="/(auth)/login" />
  if (user.must_change_password) {
    return <Redirect href={{ pathname: '/(auth)/reset-password', params: { mode: 'temporary' } }} />
  }
  return <Redirect href={getRoleHomeHref(user.role)} />
}
