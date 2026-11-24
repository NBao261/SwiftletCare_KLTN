import { Redirect, Tabs } from 'expo-router'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { RealtimeSync } from '@/components/layout/RealtimeSync'
import { getRoleTabs } from '@/constants/roleTabs'
import { useSyncAlertBadge } from '@/hooks/alert/useSyncAlertBadge'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'

// Thanh tab theo role, dựng từ ROLE_TABS (src/constants/roleTabs.ts); route không thuộc role thì ẩn
export default function TabsLayout() {
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const tabs = user ? getRoleTabs(user.role) : []
  // Số cảnh báo chưa xác nhận cho chuông (useBellCounts), chỉ role xác nhận được cảnh báo mới đếm; thanh tab không hiện số.
  // Gọi trước các lệnh return để thứ tự hook không đổi
  useSyncAlertBadge(isAuthenticated && canPerform(user, 'acknowledgeAlert'))

  if (!isAuthenticated || !user) return <Redirect href="/(auth)/login" />
  if (user.must_change_password) {
    return <Redirect href={{ pathname: '/(auth)/reset-password', params: { mode: 'temporary' } }} />
  }

  return (
    <>
      {/* Realtime của chuông và cảnh báo cho cả phiên; key theo người dùng để đổi tài khoản là bắt đầu lại */}
      <RealtimeSync key={user._id} />
      <Tabs
        // Thanh tab tự vẽ (components/layout/BottomTabBar.tsx): bo góc, bóng, nút nổi giữa
        tabBar={props => <BottomTabBar {...props} tabs={tabs} />}
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
    </>
  )
}
