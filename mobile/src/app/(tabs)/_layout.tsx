import { Redirect, Tabs } from 'expo-router'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { getRoleTabs } from '@/constants/roleTabs'
import { useAlertStore } from '@/stores/alertStore'
import { useAuthStore } from '@/stores/authStore'

// Thanh tab theo role, dựng từ ROLE_TABS (src/constants/roleTabs.ts); route không thuộc role thì ẩn
export default function TabsLayout() {
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const unreadCount = useAlertStore(state => state.unreadCount)

  if (!isAuthenticated || !user) return <Redirect href="/(auth)/login" />
  if (user.must_change_password) {
    return <Redirect href={{ pathname: '/(auth)/reset-password', params: { mode: 'temporary' } }} />
  }

  const tabs = getRoleTabs(user.role)

  return (
    <Tabs
      // Thanh tab tự vẽ (components/layout/BottomTabBar.tsx): bo góc, bóng, nút nổi giữa
      tabBar={props => <BottomTabBar {...props} tabs={tabs} unreadCount={unreadCount} />}
      screenOptions={{
        headerShown: false,
        // Mặc định ẩn mọi route trong (tabs); chỉ tab của role được bật lại bên dưới
        hidden: true,
      }}
    >
      {tabs.map(tab => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ hidden: false, title: tab.title }} />
      ))}
    </Tabs>
  )
}
