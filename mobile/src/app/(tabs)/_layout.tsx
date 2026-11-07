import { Redirect, Tabs } from 'expo-router'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { getRoleTabs } from '@/constants/roleTabs'
import { useSyncAlertBadge } from '@/hooks/alert/useSyncAlertBadge'
import { useAlertStore } from '@/stores/alertStore'
import { useAuthStore } from '@/stores/authStore'

// Thanh tab theo role, dựng từ ROLE_TABS (src/constants/roleTabs.ts); route không thuộc role thì ẩn
export default function TabsLayout() {
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const unreadCount = useAlertStore(state => state.unreadCount)
  // Số trên badge tab Cảnh báo, chỉ role có badge; gọi trước các lệnh return để thứ tự hook không đổi
  const tabs = user ? getRoleTabs(user.role) : []
  useSyncAlertBadge(isAuthenticated && tabs.some(tab => tab.showsAlertBadge))

  if (!isAuthenticated || !user) return <Redirect href="/(auth)/login" />
  if (user.must_change_password) {
    return <Redirect href={{ pathname: '/(auth)/reset-password', params: { mode: 'temporary' } }} />
  }

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
