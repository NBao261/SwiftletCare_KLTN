import { Tabs } from 'expo-router'
import { useAlertStore } from '@/store'
import { Colors } from '@/constants/theme'

export default function TabsLayout() {
  const unreadCount = useAlertStore(s => s.unreadCount)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary[600],
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: { borderTopColor: Colors.border.light, height: 60, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Tổng quan', tabBarLabel: 'Dashboard' }} />
      <Tabs.Screen name="farms"     options={{ title: 'Trang trại', tabBarLabel: 'Farms' }} />
      <Tabs.Screen name="alerts"    options={{ title: 'Cảnh báo', tabBarLabel: 'Alerts', tabBarBadge: unreadCount > 0 ? unreadCount : undefined }} />
      <Tabs.Screen name="analytics" options={{ title: 'Phân tích', tabBarLabel: 'Analytics' }} />
      <Tabs.Screen name="settings"  options={{ title: 'Cài đặt', tabBarLabel: 'Settings' }} />
    </Tabs>
  )
}
